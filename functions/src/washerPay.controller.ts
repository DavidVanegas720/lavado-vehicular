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

// C11: earned = aggregate over done orders; paid = the washer's payment docs (signed amounts, corrections included).
async function balanceOf(ctx: Ctx_, washerId: string, read: (q: any) => Promise<any>) {
  const t = tenant(ctx);
  const [earned, paid] = await Promise.all([
    read(t.collection('orders').where('washerId', '==', washerId).where('status', '==', 'done').aggregate({ s: AggregateField.sum('commissionAmount') })),
    read(t.collection('washerPayments').where('washerId', '==', washerId)),
  ]);
  return (earned.data().s as number) - (paid.docs as any[]).reduce((s, d) => s + d.data().amount, 0);
}

async function listTillPayables(ctx: Ctx_, now: Date) {
  const today = shiftOf(now, ctx.business.shifts).businessDate;
  const washers = (await tenant(ctx).collection('washers').where('active', '==', true).get()).docs.map((d) => d.data());
  const get = (q: any) => q.get();
  return Promise.all(washers.map(async (w) => {
    const { start, end } = payPeriodOf(today, w.payFrequency);
    // shortcut: one period of orders read and filtered in memory (equality + range needs a composite index), upgrade with an index.
    const inPeriod = await tenant(ctx).collection('orders').where('businessDate', '>=', start).where('businessDate', '<=', end).get();
    return {
      washerId: w.id, name: w.name, payFrequency: w.payFrequency,
      balanceOwed: await balanceOf(ctx, w.id, get),
      currentEarned: inPeriod.docs.map((d) => d.data()).filter((o) => o.washerId === w.id).reduce((s, o) => s + earnedOf(o as any), 0),
    };
  }));
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
      const w = typeof body.washerId === 'string' && body.washerId ? await tx.get(t.collection('washers').doc(body.washerId)) : undefined;
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
}
