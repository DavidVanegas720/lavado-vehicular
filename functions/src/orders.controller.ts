import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { db, tenant, plain } from './firebase.js';
import { shiftOf, shiftState } from './domain/shift.js';
import { buildOrder, finishFields, cancelFields } from './domain/order.js';
import { readCatalog } from './catalog.controller.js';
import { clock, type Ctx_ } from './shifts.controller.js';

type Req_ = { headers: Record<string, string | string[] | undefined> };
type Doc = FirebaseFirestore.DocumentData;
const CLIENT_ID = /^[0-9a-f-]{36}$/; // C7

const stateOf = async (ctx: Ctx_, key: string, read: (q: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot>) => {
  const evs = (await read(tenant(ctx).collection('shiftEvents').where('shiftKey', '==', key))).docs.map((d) => d.data()).sort((a, b) => a.seq - b.seq);
  return shiftState(evs as any, key);
};

const ALLOWED = ['plate', 'plateSpecial', 'vehicleType', 'cc', 'categoryId', 'washTypeId', 'washerId', 'isCourtesy', 'courtesyReason'];

// Replay rule of C7: the same creator gets the stored order back; anyone else gets invalid_state.
const replay = (ctx: Ctx_, id: string, o: Doc) => {
  if (o.createdBy !== ctx.uid) throw coded('invalid_state');
  return { id, ...plain(o) };
};

async function create(ctx: Ctx_ & { business: { enabledVehicleTypes: string[] } }, body: Doc, now: Date) {
  const id = body?.id;
  if (typeof id !== 'string' || !CLIENT_ID.test(id)) throw coded('validation');
  const input = Object.fromEntries(ALLOWED.filter((k) => k in body).map((k) => [k, body[k]]));
  const ref = tenant(ctx).collection('orders').doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const key = shiftOf(now, ctx.business.shifts).shiftKey;
      const [prior, catalog, state] = await Promise.all([tx.get(ref), readCatalog({ ...ctx, role: 'operator' }, (q) => tx.get(q)), stateOf(ctx, key, (q) => tx.get(q))]);
      if (prior.exists) return replay(ctx, id, prior.data()!);
      if (!ctx.business.enabledVehicleTypes.includes((input.vehicleType as string) ?? 'motorcycle')) throw coded('forbidden');
      const order = buildOrder(input as any, catalog, { uid: ctx.uid, role: 'operator' }, now, ctx.business.shifts);
      if (state !== 'open') throw coded('shift_not_open');
      const vref = tenant(ctx).collection('vehicles').doc(order.plate);
      const v = await tx.get(vref);
      tx.create(ref, order);
      if (v.exists) tx.update(vref, { lastCc: order.cc, lastWashAt: now, totalWashes: v.data()!.totalWashes + 1 });
      else tx.create(vref, { plate: order.plate, vehicleType: order.vehicleType, plateSpecial: order.plateSpecial, totalWashes: 1, firstWashAt: now, lastCc: order.cc, lastWashAt: now });
      return { id, ...order };
    });
  } catch (e) {
    if ((e as { code?: unknown }).code !== 6) throw e;
    return replay(ctx, id, (await ref.get()).data()!); // ALREADY_EXISTS: lost the race, apply the replay rule
  }
}

// Finish and cancel: tenant lookup, closed-shift check, then the domain transition (same order as the mock).
async function transition(ctx: Ctx_, orderId: unknown, input: unknown, fieldsFn: (o: Doc, i: any, u: { uid: string; role: any }, n: Date) => Doc, now: Date) {
  if (typeof orderId !== 'string' || !CLIENT_ID.test(orderId)) throw coded('not_found');
  const ref = tenant(ctx).collection('orders').doc(orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw coded('not_found');
    const order = snap.data()!;
    if ((await stateOf(ctx, order.shiftKey, (q) => tx.get(q))) === 'closed') throw coded('shift_closed');
    const fields = fieldsFn(order, input, { uid: ctx.uid, role: ctx.role }, now);
    tx.update(ref, fields);
    return { id: orderId, ...plain({ ...order, ...fields }) };
  });
}

async function listShift(ctx: Ctx_, now: Date) {
  const orders = tenant(ctx).collection('orders');
  const key = shiftOf(now, ctx.business.shifts).shiftKey;
  const [cur, open] = await Promise.all([
    orders.where('createdBy', '==', ctx.uid).where('shiftKey', '==', key).get(),
    orders.where('createdBy', '==', ctx.uid).where('status', '==', 'in_progress').get(),
  ]);
  const byId = new Map<string, Doc>();
  for (const d of [...cur.docs, ...open.docs]) byId.set(d.id, { id: d.id, ...plain(d.data()) });
  const keys = [...new Set([...byId.values()].filter((o) => o.shiftKey !== key).map((o) => o.shiftKey as string))];
  const closed = new Set<string>();
  for (const k of keys) if ((await stateOf(ctx, k, (q) => q.get())) === 'closed') closed.add(k);
  return [...byId.values()].filter((o) => o.shiftKey === key || !closed.has(o.shiftKey)).sort((a, b) => b.createdAt - a.createdAt);
}

@Controller('orders')
export class OrdersController {
  @Post('create')
  @HttpCode(200)
  @Roles('operator')
  create(@Ctx() ctx: any, @Body() b: Doc, @Req() req: Req_) { return create(ctx, b, clock(req)); }

  @Post('finish')
  @HttpCode(200)
  @Roles('admin', 'operator')
  finish(@Ctx() ctx: Ctx_, @Body() b: Doc, @Req() req: Req_) { return transition(ctx, b?.orderId, b, finishFields as any, clock(req)); }

  @Post('cancel')
  @HttpCode(200)
  @Roles('admin', 'operator')
  cancel(@Ctx() ctx: Ctx_, @Body() b: Doc, @Req() req: Req_) { return transition(ctx, b?.orderId, b, cancelFields as any, clock(req)); }

  @Post('listShift')
  @HttpCode(200)
  @Roles('operator')
  listShift(@Ctx() ctx: Ctx_, @Req() req: Req_) { return listShift(ctx, clock(req)); }
}
