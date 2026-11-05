import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { db, plain } from './firebase.js';
import { assertShifts, bogotaDate } from './domain/shift.js';
import { billingAlerts } from './domain/billing.js';
import { clock } from './shifts.controller.js';
import { createLogin, loginInput } from './operators.controller.js';

type Doc = FirebaseFirestore.DocumentData;
type Req_ = { headers: Record<string, string | string[] | undefined> };
const TYPES = ['motorcycle', 'car'];
const CLIENT_ID = /^[0-9a-f-]{36}$/; // C7
const settings = () => db.doc('platform/settings');

const text = (v: unknown, max: number) => {
  const n = typeof v === 'string' ? v.trim() : '';
  if (n.length < 1 || n.length > max) throw coded('validation');
  return n;
};
const date = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw coded('validation');
  return v;
};
const money = (v: unknown, min: number) => {
  if (!Number.isInteger(v) || (v as number) < min) throw coded('validation');
  return v as number;
};
const types = (v: unknown) => {
  if (!Array.isArray(v) || v.length < 1 || v.some((t) => !TYPES.includes(t)) || new Set(v).size !== v.length) throw coded('validation');
  return [...v] as string[];
};
// F4: the id comes in the body; a slash would address another path
const ref = (id: unknown) => {
  if (typeof id !== 'string' || !id || id.includes('/')) throw coded('not_found');
  return db.doc('businesses/' + id);
};
// F6: field by field, never a spread of the document
const view = (id: string, b: Doc) => ({
  id, name: b.name, enabledVehicleTypes: b.enabledVehicleTypes, status: b.status, blockedAt: plain(b.blockedAt), blockedReason: b.blockedReason,
  billing: { monthlyFee: b.billing.monthlyFee, paidUntil: b.billing.paidUntil, lastPaymentAt: plain(b.billing.lastPaymentAt) },
  shifts: b.shifts.map((s: Doc) => ({ id: s.id, name: s.name, startHour: s.startHour, endHour: s.endHour })),
});
const paymentView = (businessId: string, id: string, p: Doc) => ({ id, businessId, ...plain(p) });

async function windowDays() {
  const d = (await settings().get()).data()?.alertWindowDays;
  return Number.isInteger(d) ? (d as number) : 5; // CLAUDE.md "Billing": missing reads as 5
}

async function list(now: Date) {
  // shortcut: reads every business, paginate past ~1k businesses
  const [snap, days] = await Promise.all([db.collection('businesses').get(), windowDays()]);
  const businesses = snap.docs.map((d) => view(d.id, d.data()));
  const a = billingAlerts(businesses, bogotaDate(now), days);
  return { businesses, alerts: { overdue: a.overdue.map((b) => b.id), expiring: a.expiring.map((b) => b.id) }, alertWindowDays: days };
}

async function create(ctx: { uid: string }, b: Doc, now: Date) {
  const business = {
    name: text(b.name, 60), enabledVehicleTypes: types(b.enabledVehicleTypes), status: 'active', blockedAt: null, blockedReason: null,
    billing: { monthlyFee: money(b.monthlyFee, 0), paidUntil: date(b.paidUntil), lastPaymentAt: null },
    // placeholder: real shift hours pending David (00-master §6)
    shifts: [{ id: 'unico', name: 'Turno único', startHour: 6, endHour: 6 }],
  };
  const adminName = text(b.adminName, 60);
  const { email, password } = loginInput({ email: b.adminEmail, password: b.adminPassword }, 12);
  const r = db.collection('businesses').doc();
  return createLogin(email, password, { role: 'admin', businessId: r.id }, async (uid) => {
    const batch = db.batch();
    batch.create(r, { ...business, createdAt: Timestamp.fromDate(now) });
    batch.create(r.collection('members').doc(uid), { name: adminName, role: 'admin', active: true, email, createdAt: Timestamp.fromDate(now), createdBy: ctx.uid });
    await batch.commit();
    return view(r.id, business);
  });
}

async function update(b: Doc) {
  const r = ref(b.businessId);
  const name = text(b.name, 60), t = types(b.enabledVehicleTypes), fee = money(b.monthlyFee, 0);
  if (!Array.isArray(b.shifts) || b.shifts.some((s: unknown) => !s || typeof s !== 'object')) throw coded('validation');
  const sent = b.shifts.map((s: Doc) => s?.id ?? null);
  return db.runTransaction(async (tx) => {
    const cur = (await tx.get(r)).data();
    if (!cur) throw coded('not_found');
    // F7: a sent id must be one of the business's own, no repeats
    const known = sent.filter((x: unknown) => x !== null);
    if (new Set(known).size !== known.length || known.some((x: any) => !cur.shifts.some((s: Doc) => s.id === x))) throw coded('validation');
    const shifts = b.shifts.map((s: Doc, i: number) => ({ id: sent[i] ?? db.collection('x').doc().id, name: text(s.name, 40), startHour: s.startHour, endHour: s.endHour }));
    try { assertShifts(shifts); } catch { throw coded('validation'); }
    tx.update(r, { name, enabledVehicleTypes: t, shifts, 'billing.monthlyFee': fee }); // dotted path: paidUntil is never rewritten
    return view(r.id, { ...cur, name, enabledVehicleTypes: t, shifts, billing: { ...cur.billing, monthlyFee: fee } });
  });
}

async function setBlocked(b: Doc, now: Date) {
  const r = ref(b.businessId);
  if (typeof b.blocked !== 'boolean') throw coded('validation');
  const reason = b.blocked ? text(b.reason, 200) : null; // validate before writing: a failed block changes nothing
  return db.runTransaction(async (tx) => {
    const cur = (await tx.get(r)).data();
    if (!cur) throw coded('not_found');
    const patch = { status: b.blocked ? 'blocked' : 'active', blockedAt: b.blocked ? Timestamp.fromDate(now) : null, blockedReason: reason };
    tx.update(r, patch);
    return view(r.id, { ...cur, ...patch });
  });
}

async function setWindow(days: unknown) {
  if (!Number.isInteger(days) || (days as number) < 1 || (days as number) > 60) throw coded('validation');
  await settings().set({ alertWindowDays: days }, { merge: true });
  return days;
}

async function listPayments(b: Doc) {
  const r = ref(b.businessId);
  if (!(await r.get()).exists) throw coded('not_found');
  const s = await r.collection('billingPayments').get();
  return s.docs.map((d) => paymentView(r.id, d.id, d.data())).sort((x, y) => x.createdAt - y.createdAt);
}

const replay = (ctx: { uid: string }, bid: string, id: string, p: Doc) => {
  if (p.recordedBy !== ctx.uid) throw coded('invalid_state');
  return paymentView(bid, id, p);
};

async function recordPayment(ctx: { uid: string }, b: Doc, now: Date) {
  const r = ref(b.businessId);
  const id = b.id;
  if (typeof id !== 'string' || !CLIENT_ID.test(id)) throw coded('validation');
  const pr = r.collection('billingPayments').doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const [prior, biz] = await Promise.all([tx.get(pr), tx.get(r)]);
      if (!biz.exists) throw coded('not_found');
      if (prior.exists) return replay(ctx, r.id, id, prior.data()!);
      if (typeof b.periodMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.periodMonth)) throw coded('validation');
      const payment = {
        amount: money(b.amount, 1), periodMonth: b.periodMonth, method: text(b.method, 30), note: b.note ? text(b.note, 200) : '',
        paidUntil: date(b.paidUntil), recordedBy: ctx.uid, createdAt: Timestamp.fromDate(now),
      };
      tx.create(pr, payment);
      tx.update(r, { 'billing.paidUntil': payment.paidUntil, 'billing.lastPaymentAt': payment.createdAt }); // never the fee
      return paymentView(r.id, id, payment);
    });
  } catch (e) {
    if ((e as { code?: unknown }).code !== 6) throw e;
    return replay(ctx, r.id, id, (await pr.get()).data()!); // ALREADY_EXISTS: lost the race, apply the replay rule
  }
}

@Controller('businesses')
export class BusinessesController {
  @Post('list') @HttpCode(200) @Roles('superadmin')
  list(@Req() req: Req_) { return list(clock(req)); }

  @Post('create') @HttpCode(200) @Roles('superadmin')
  create(@Ctx() ctx: { uid: string }, @Body() b: Doc, @Req() req: Req_) { return create(ctx, b ?? {}, clock(req)); }

  @Post('update') @HttpCode(200) @Roles('superadmin')
  update(@Body() b: Doc) { return update(b ?? {}); }

  @Post('setBlocked') @HttpCode(200) @Roles('superadmin')
  setBlocked(@Body() b: Doc, @Req() req: Req_) { return setBlocked(b ?? {}, clock(req)); }

  @Post('setAlertWindowDays') @HttpCode(200) @Roles('superadmin')
  setAlertWindowDays(@Body() b: Doc) { return setWindow(b?.days); }

  @Post('listBillingPayments') @HttpCode(200) @Roles('superadmin')
  listBillingPayments(@Body() b: Doc) { return listPayments(b ?? {}); }

  @Post('recordBillingPayment') @HttpCode(200) @Roles('superadmin')
  recordBillingPayment(@Ctx() ctx: { uid: string }, @Body() b: Doc, @Req() req: Req_) { return recordPayment(ctx, b ?? {}, clock(req)); }
}
