import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { db, tenant, plain } from './firebase.js';
import { shiftOf, shiftState } from './domain/shift.js';
import { shiftTotals, expectedCash } from './domain/order.js';

// The clock: an x-test-now header is honored only on the emulator (10-p8 R5 option a); in production it is ignored.
const clock = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const h = req.headers['x-test-now'];
  if (!h || !process.env.FIRESTORE_EMULATOR_HOST) return new Date();
  const d = new Date(String(h));
  if (Number.isNaN(d.getTime())) throw coded('validation');
  return d;
};

type Ctx_ = { uid: string; role?: string; businessId: string; business: { shifts: Parameters<typeof shiftOf>[1] } };

async function openShift(ctx: Ctx_, openingCash: unknown, now: Date) {
  if (!Number.isInteger(openingCash) || (openingCash as number) < 0) throw coded('validation');
  const cur = shiftOf(now, ctx.business.shifts);
  const events = tenant(ctx).collection('shiftEvents');
  try {
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(events.where('shiftKey', '==', cur.shiftKey))).empty) throw coded('invalid_state');
      tx.create(events.doc(`${cur.shiftKey}_open`), {
        type: 'open', shiftKey: cur.shiftKey, shiftName: cur.shiftName, endsAt: cur.endsAt,
        seq: 0, openingCash, at: now, by: ctx.uid,
      });
    });
  } catch (e) {
    if ((e as { code?: unknown }).code === 6) throw coded('invalid_state'); // ALREADY_EXISTS: lost the race (B8)
    throw e;
  }
  return {};
}

type Req = { headers: Record<string, string | string[] | undefined> };
type Doc = FirebaseFirestore.DocumentData;
type Read = (q: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot>;

const bySeq = (a: Doc, b: Doc) => a.seq - b.seq;
const shiftKeyOf = (v: unknown) => { if (typeof v !== 'string' || !v) throw coded('validation'); return v; };

// Events of one instance, in order (C9), plus its orders and till payments (C10).
async function instance(ctx: Ctx_, shiftKey: string, read: Read) {
  const t = tenant(ctx);
  const [ev, od, pay] = await Promise.all([
    read(t.collection('shiftEvents').where('shiftKey', '==', shiftKey)),
    read(t.collection('orders').where('shiftKey', '==', shiftKey)),
    read(t.collection('washerPayments').where('shiftKey', '==', shiftKey).where('source', '==', 'till')),
  ]);
  const events = ev.docs.map((d) => plain(d.data())).sort(bySeq);
  const opened = events.find((e) => e.type === 'open');
  return {
    events, opened, state: shiftState(events, shiftKey),
    orders: od.docs.map((d) => ({ id: d.id, ...plain(d.data()) })),
    tillPayments: pay.docs.map((d) => plain(d.data())),
  };
}

// Close and reopen: fixed id per seq, so two racing writers collide on one document (C9).
async function appendEvent(ctx: Ctx_, shiftKey: string, now: Date, check: (i: Awaited<ReturnType<typeof instance>>) => Doc) {
  try {
    return await db.runTransaction(async (tx) => {
      const i = await instance(ctx, shiftKey, (q) => tx.get(q));
      const body = check(i);
      const ev = { ...body, shiftKey, shiftName: i.opened.shiftName, endsAt: i.opened.endsAt, seq: i.events.length, at: now, by: ctx.uid };
      tx.create(tenant(ctx).collection('shiftEvents').doc(`${shiftKey}_${ev.seq}`), ev);
      return ev;
    });
  } catch (e) {
    if ((e as { code?: unknown }).code === 6) throw coded('invalid_state'); // ALREADY_EXISTS: lost the race
    throw e;
  }
}

async function status(ctx: Ctx_, now: Date) {
  const cur = shiftOf(now, ctx.business.shifts);
  // shortcut: an instance unclosed for over 31 days drops off the operator's list; the admin list (P10) reads all
  const snap = await tenant(ctx).collection('shiftEvents').where('at', '>=', new Date(now.getTime() - 31 * 86400000)).get();
  const evs = snap.docs.map((d) => plain(d.data())).sort((a, b) => a.at - b.at || a.seq - b.seq);
  const keys = [...new Set(evs.map((e) => e.shiftKey as string))].filter((k) => evs.some((e) => e.shiftKey === k && e.type === 'open'));
  const inWindow = evs.filter((e) => keys.includes(e.shiftKey));
  const state = (k: string) => shiftState(inWindow, k);
  const unclosed = inWindow
    .filter((e) => e.type === 'open' && e.endsAt <= now && state(e.shiftKey) === 'open')
    .map((e) => ({ shiftKey: e.shiftKey, shiftName: e.shiftName, endsAt: e.endsAt }));
  const recentClosed = [...new Set(inWindow.filter((e) => e.type === 'close').map((e) => e.shiftKey as string).reverse())]
    .filter((k) => state(k) === 'closed')
    .slice(0, 5)
    .map((k) => { const o = inWindow.find((e) => e.shiftKey === k && e.type === 'open'); return { shiftKey: k, shiftName: o.shiftName, endsAt: o.endsAt }; });
  return {
    recentClosed,
    current: { shiftKey: cur.shiftKey, shiftName: cur.shiftName, businessDate: cur.businessDate, endsAt: cur.endsAt, state: state(cur.shiftKey) },
    unclosed,
  };
}

async function closePreview(ctx: Ctx_, key: unknown) {
  const i = await instance(ctx, shiftKeyOf(key), (q) => q.get());
  if (i.state !== 'open') throw coded('invalid_state');
  const unfinished = i.orders.filter((o) => o.status === 'in_progress');
  const ids = [...new Set(unfinished.map((o) => o.createdBy as string))];
  const names = new Map<string, string>();
  if (ids.length) for (const m of await db.getAll(...ids.map((id) => tenant(ctx).collection('members').doc(id)))) names.set(m.id, m.data()?.name);
  return {
    shiftKey: key, shiftName: i.opened.shiftName, endsAt: i.opened.endsAt, openingCash: i.opened.openingCash,
    salesByMethod: shiftTotals(i.orders).salesByMethod,
    tillPayments: i.tillPayments.map((p) => ({ washerName: p.washerName, amount: p.amount })),
    unfinished: unfinished.map((o) => ({ id: o.id, plate: o.plate, createdByName: names.get(o.createdBy) ?? o.createdBy })),
  };
}

const closeShift = (ctx: Ctx_, key: unknown, countedCash: unknown, now: Date) => {
  if (!Number.isInteger(countedCash) || (countedCash as number) < 0) throw coded('validation');
  const k = shiftKeyOf(key);
  return appendEvent(ctx, k, now, (i) => {
    if (i.state !== 'open' || now < i.opened.endsAt || i.orders.some((o) => o.status === 'in_progress')) throw coded('invalid_state');
    const expected = expectedCash(i.opened.openingCash, i.orders, i.tillPayments);
    return { type: 'close', countedCash, expectedCash: expected, difference: (countedCash as number) - expected, totals: shiftTotals(i.orders) };
  });
};

async function reopen(ctx: Ctx_, key: unknown, reason: unknown, now: Date) {
  const r = typeof reason === 'string' ? reason.trim() : '';
  if (r.length < 1 || r.length > 200) throw coded('validation');
  await appendEvent(ctx, shiftKeyOf(key), now, (i) => {
    if (i.state !== 'closed') throw coded('invalid_state');
    return { type: 'reopen', reason: r };
  });
  return {};
}

@Controller('shifts')
export class ShiftsController {
  @Post('open')
  @HttpCode(200)
  @Roles('operator')
  open(@Ctx() ctx: Ctx_, @Body() body: { openingCash?: unknown }, @Req() req: { headers: Record<string, string | string[] | undefined> }) {
    return openShift(ctx, body?.openingCash, clock(req));
  }

  @Post('status')
  @HttpCode(200)
  @Roles('admin', 'operator')
  status(@Ctx() ctx: Ctx_, @Req() req: Req) { return status(ctx, clock(req)); }

  @Post('closePreview')
  @HttpCode(200)
  @Roles('operator')
  closePreview(@Ctx() ctx: Ctx_, @Body() b: { shiftKey?: unknown }) { return closePreview(ctx, b?.shiftKey); }

  @Post('close')
  @HttpCode(200)
  @Roles('operator')
  close(@Ctx() ctx: Ctx_, @Body() b: { shiftKey?: unknown; countedCash?: unknown }, @Req() req: Req) {
    return closeShift(ctx, b?.shiftKey, b?.countedCash, clock(req));
  }

  @Post('reopen')
  @HttpCode(200)
  @Roles('operator')
  reopen(@Ctx() ctx: Ctx_, @Body() b: { shiftKey?: unknown; reason?: unknown }, @Req() req: Req) {
    return reopen(ctx, b?.shiftKey, b?.reason, clock(req));
  }
}
