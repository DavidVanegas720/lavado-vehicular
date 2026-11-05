import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { AggregateField } from 'firebase-admin/firestore';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { db, tenant, plain } from './firebase.js';
import { shiftOf, shiftState } from './domain/shift.js';
import { payPeriodOf, previousPeriodOf, earnedOf } from './domain/washerPay.js';
import { clock, type Ctx_ } from './shifts.controller.js';

type Req_ = { headers: Record<string, string | string[] | undefined> };
type Doc = FirebaseFirestore.DocumentData;
const CLIENT_ID = /^[0-9a-f-]{36}$/; // C7

// C11/E10: earned = sum() over done orders (optionally inside a businessDate range); paid = the washer's payment docs (signed, corrections included).
async function earnedSum(ctx: Ctx_, washerId: string, read: (q: any) => Promise<any>, range?: { start: string; end: string }) {
  let q = tenant(ctx).collection('orders').where('washerId', '==', washerId).where('status', '==', 'done');
  if (range) q = q.where('businessDate', '>=', range.start).where('businessDate', '<=', range.end);
  return (await read(q.aggregate({ s: AggregateField.sum('commissionAmount') }))).data().s as number;
}
const payments = (ctx: Ctx_, washerId: string, read: (q: any) => Promise<any>) => read(tenant(ctx).collection('washerPayments').where('washerId', '==', washerId));
const total = (docs: any[]) => docs.reduce((s, d) => s + d.data().amount, 0);

async function balanceOf(ctx: Ctx_, washerId: string, read: (q: any) => Promise<any>) {
  const [earned, paid] = await Promise.all([earnedSum(ctx, washerId, read), payments(ctx, washerId, read)]);
  return earned - total(paid.docs);
}

async function listTillPayables(ctx: Ctx_, now: Date) {
  const today = shiftOf(now, ctx.business.shifts).businessDate;
  const washers = (await tenant(ctx).collection('washers').where('active', '==', true).get()).docs.map((d) => d.data());
  const get = (q: any) => q.get();
  return Promise.all(washers.map(async (w) => ({
    washerId: w.id, name: w.name, payFrequency: w.payFrequency,
    balanceOwed: await balanceOf(ctx, w.id, get),
    currentEarned: await earnedSum(ctx, w.id, get, payPeriodOf(today, w.payFrequency)),
  })));
}

const replay = (ctx: Ctx_, id: string, p: Doc) => {
  if (p.recordedBy !== ctx.uid) throw coded('invalid_state');
  return { id, ...plain(p) };
};

async function recordTillPayment(ctx: Ctx_, body: Doc, now: Date) {
  const id = body?.id;
  if (typeof id !== 'string' || !CLIENT_ID.test(id)) throw coded('validation');
  const shiftKey = body.shiftKey;
  if (typeof shiftKey !== 'string' || !shiftKey) throw coded('validation');
  const t = tenant(ctx);
  const ref = t.collection('washerPayments').doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const [prior, evs] = await Promise.all([tx.get(ref), tx.get(t.collection('shiftEvents').where('shiftKey', '==', shiftKey))]);
      if (prior.exists) return replay(ctx, id, prior.data()!);
      const state = shiftState(evs.docs.map((d) => d.data()).sort((a, b) => a.seq - b.seq) as any, shiftKey);
      if (state === 'not_opened') throw coded('shift_not_open');
      if (state === 'closed') throw coded('shift_closed');
      const w = typeof body.washerId === 'string' && body.washerId && !body.washerId.includes('/') ? await tx.get(t.collection('washers').doc(body.washerId)) : undefined;
      if (!w?.exists || !w.data()!.active) throw coded('not_found');
      const washer = w.data()!;
      const businessDate = shiftKey.split('_')[0];
      const period = body.period ?? (washer.payFrequency === 'daily' ? 'current' : 'previous');
      if (period !== 'previous' && period !== 'current') throw coded('validation');
      const owed = await balanceOf(ctx, washer.id, (q) => tx.get(q));
      if (!Number.isInteger(body.amount) || body.amount < 1 || body.amount > owed) throw coded('validation');
      const { periodKey } = (period === 'current' ? payPeriodOf : previousPeriodOf)(businessDate, washer.payFrequency);
      const payment = {
        type: 'payment', washerId: washer.id, washerName: washer.name, payFrequency: washer.payFrequency, periodKey,
        amount: body.amount, source: 'till', shiftKey, businessDate, paidAt: now, recordedBy: ctx.uid,
        note: typeof body.note === 'string' ? body.note.trim() : '',
      };
      tx.create(ref, payment);
      return { id, ...payment };
    });
  } catch (e) {
    if ((e as { code?: unknown }).code !== 6) throw e;
    return replay(ctx, id, (await ref.get()).data()!); // ALREADY_EXISTS: lost the race, apply the replay rule
  }
}

// Admin reads (E10, E11). Every washer, active or not.
async function listBalances(ctx: Ctx_, now: Date) {
  const today = shiftOf(now, ctx.business.shifts).businessDate;
  const get = (q: any) => q.get();
  const washers = (await tenant(ctx).collection('washers').get()).docs.map((d) => ({ ...d.data(), id: d.id }) as Doc);
  return Promise.all(washers.map(async (w) => {
    const [cur, prev] = [payPeriodOf(today, w.payFrequency), previousPeriodOf(today, w.payFrequency)];
    const [pays, all, eCur, ePrev] = await Promise.all([
      payments(ctx, w.id, get), earnedSum(ctx, w.id, get), earnedSum(ctx, w.id, get, cur), earnedSum(ctx, w.id, get, prev)]);
    const entries = pays.docs.map((d: any) => d.data());
    const paidIn = (key: string) => entries.filter((p: Doc) => p.type === 'payment' && p.periodKey === key).reduce((s: number, p: Doc) => s + p.amount, 0);
    return {
      washerId: w.id, name: w.name, active: w.active, payFrequency: w.payFrequency, balanceOwed: all - total(pays.docs),
      current: { periodKey: cur.periodKey, earned: eCur, paid: paidIn(cur.periodKey) },
      previous: { periodKey: prev.periodKey, earned: ePrev, paid: paidIn(prev.periodKey) },
    };
  }));
}

async function getLedger(ctx: Ctx_, washerId: unknown) {
  const t = tenant(ctx);
  if (typeof washerId !== 'string' || !washerId || washerId.includes('/')) throw coded('not_found');
  const w = await t.collection('washers').doc(washerId).get();
  if (!w.exists) throw coded('not_found');
  // shortcut: all orders of one washer, paginate by period when a washer passes ~5k orders
  const [orders, pays] = await Promise.all([
    t.collection('orders').where('washerId', '==', washerId).select('businessDate', 'status', 'commissionAmount').get(),
    payments(ctx, washerId, (q) => q.get()),
  ]);
  const periods = new Map<string, any>();
  for (const d of orders.docs) {
    const o = d.data();
    const p = payPeriodOf(o.businessDate, w.data()!.payFrequency);
    const row = periods.get(p.periodKey) ?? periods.set(p.periodKey, { ...p, earned: 0, paid: 0 }).get(p.periodKey);
    row.earned += earnedOf(o as any);
  }
  const entries = pays.docs.map((d: any) => ({ id: d.id, ...plain(d.data()) }));
  for (const e of entries) if (e.type === 'payment' && periods.has(e.periodKey)) periods.get(e.periodKey).paid += e.amount;
  return {
    periods: [...periods.values()].sort((a, b) => b.start.localeCompare(a.start)),
    entries: entries.sort((a: Doc, b: Doc) => b.paidAt - a.paidAt),
  };
}

// E9: admin outside payment and correction. Client id required; same retry-safe shape as recordTillPayment.
async function recordAdmin(ctx: Ctx_, body: Doc, now: Date, kind: 'payment' | 'correction') {
  const id = body?.id;
  if (typeof id !== 'string' || !CLIENT_ID.test(id)) throw coded('validation');
  const t = tenant(ctx);
  const ref = t.collection('washerPayments').doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const prior = await tx.get(ref);
      if (prior.exists) return replay(ctx, id, prior.data()!);
      const w = typeof body.washerId === 'string' && body.washerId && !body.washerId.includes('/') ? await tx.get(t.collection('washers').doc(body.washerId)) : undefined;
      if (!w?.exists) throw coded(kind === 'payment' ? 'validation' : 'not_found');
      const washer = w.data()!;
      const businessDate = shiftOf(now, ctx.business.shifts).businessDate;
      const base = { type: kind, washerId: w.id, washerName: washer.name, payFrequency: washer.payFrequency, shiftKey: null, businessDate, paidAt: now, recordedBy: ctx.uid };
      let entry: Doc;
      if (kind === 'payment') {
        const period = body.period ?? (washer.payFrequency === 'daily' ? 'current' : 'previous');
        if (period !== 'previous' && period !== 'current') throw coded('validation');
        const owed = await balanceOf(ctx, w.id, (q) => tx.get(q));
        if (!Number.isInteger(body.amount) || body.amount < 1 || body.amount > owed) throw coded('validation');
        const { periodKey } = (period === 'current' ? payPeriodOf : previousPeriodOf)(businessDate, washer.payFrequency);
        entry = { ...base, periodKey, amount: body.amount, source: 'outside', note: typeof body.note === 'string' ? body.note.trim() : '' };
      } else {
        if (!Number.isInteger(body.amount) || body.amount === 0) throw coded('validation');
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (reason.length < 1 || reason.length > 200) throw coded('validation');
        entry = { ...base, periodKey: null, amount: body.amount, source: 'correction', reason };
      }
      tx.create(ref, entry);
      return { id, ...entry };
    });
  } catch (e) {
    if ((e as { code?: unknown }).code !== 6) throw e;
    return replay(ctx, id, (await ref.get()).data()!); // ALREADY_EXISTS: lost the race, apply the replay rule
  }
}

@Controller('washerPay')
export class WasherPayController {
  @Post('listTillPayables')
  @HttpCode(200)
  @Roles('operator')
  list(@Ctx() ctx: Ctx_, @Req() req: Req_) { return listTillPayables(ctx, clock(req)); }

  @Post('recordTillPayment')
  @HttpCode(200)
  @Roles('operator')
  record(@Ctx() ctx: Ctx_, @Body() b: Doc, @Req() req: Req_) { return recordTillPayment(ctx, b, clock(req)); }

  @Post('listBalances')
  @HttpCode(200)
  @Roles('admin')
  balances(@Ctx() ctx: Ctx_, @Req() req: Req_) { return listBalances(ctx, clock(req)); }

  @Post('getLedger')
  @HttpCode(200)
  @Roles('admin')
  ledger(@Ctx() ctx: Ctx_, @Body() b: Doc) { return getLedger(ctx, b?.washerId); }

  @Post('recordOutsidePayment')
  @HttpCode(200)
  @Roles('admin')
  outside(@Ctx() ctx: Ctx_, @Body() b: Doc, @Req() req: Req_) { return recordAdmin(ctx, b, clock(req), 'payment'); }

  @Post('recordCorrection')
  @HttpCode(200)
  @Roles('admin')
  correction(@Ctx() ctx: Ctx_, @Body() b: Doc, @Req() req: Req_) { return recordAdmin(ctx, b, clock(req), 'correction'); }
}
