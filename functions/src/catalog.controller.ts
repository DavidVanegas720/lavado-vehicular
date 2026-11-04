import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { db, tenant, plain } from './firebase.js';
import { clock, type Ctx_ } from './shifts.controller.js';
import { PAY_FREQUENCIES, missingPrices } from './domain/catalog.js';
import { findOverlap } from './domain/displacement.js';

type Read = (q: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot>;

// Operators see only active items, and prices only for pairs they can order (mock `visible`, D2.7). Admin sees all.
export async function readCatalog(ctx: Ctx_, read: Read) {
  const t = tenant(ctx);
  const [categories, washTypes, washers, prices] = await Promise.all(
    ['categories', 'washTypes', 'washers', 'prices'].map(async (n) => (await read(t.collection(n))).docs.map((d) => plain(d.data()))));
  if (ctx.role === 'admin') return { categories, washTypes, washers, prices };
  const active = (l: any[]) => l.filter((x) => x.active);
  const on = (l: any[], id: string) => l.some((x) => x.id === id && x.active);
  return {
    categories: active(categories), washTypes: active(washTypes), washers: active(washers),
    prices: prices.filter((p) => on(categories, p.categoryId) && on(washTypes, p.washTypeId)),
  };
}

type Doc = FirebaseFirestore.DocumentData;
type Req_ = { headers: Record<string, string | string[] | undefined> };
type C = Ctx_ & { business: { enabledVehicleTypes: string[] } };
type Cat = { categories: Doc[]; washTypes: Doc[]; prices: Doc[] };
type Tx = FirebaseFirestore.Transaction;
const HISTORY = ['commissionHistory', 'payFrequencyHistory'] as const;

// Validation ported line by line from src/mocks/catalog.js (same codes, same limits).
const name = (v: unknown) => {
  const n = typeof v === 'string' ? v.trim() : '';
  if (n.length < 1 || n.length > 60) throw coded('validation');
  return n;
};
const int = (v: unknown, min: number, max = Infinity) => {
  if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) throw coded('validation');
  return v as number;
};
const bool = (v: unknown) => { if (typeof v !== 'boolean') throw coded('validation'); return v; };
const frequency = (f: unknown) => { if (typeof f !== 'string' || !Object.hasOwn(PAY_FREQUENCIES, f)) throw coded('validation'); return f; };
const enabled = (ctx: C, vt: unknown = 'motorcycle') => {
  if (typeof vt !== 'string' || !ctx.business.enabledVehicleTypes.includes(vt)) throw coded('forbidden');
  return vt;
};
const find = (list: Doc[], id: unknown) => list.find((x) => x.id === id) ?? (() => { throw coded('not_found'); })();
const noOverlap = (cat: Doc, cats: Doc[]) => { if (findOverlap(cat as any, cats as any)) throw coded('cc_overlap'); };
const complete = (cats: Doc[], types: Doc[], prices: Doc[]) => { if (missingPrices(cats as any, types as any, prices as any).length) throw coded('price_missing'); };
const swap = (list: Doc[], item: Doc, next: Doc) => list.map((x) => (x === item ? next : x));

/** `{ otherId: price }` -> price rows; every id must be one of `others`. */
function priceRows(map: unknown, others: Doc[], make: (id: string) => Doc) {
  if (map == null) return [];
  if (typeof map !== 'object' || Array.isArray(map)) throw coded('validation');
  return Object.entries(map).map(([id, price]) => { find(others, id); return { ...make(id), price: int(price, 1) }; });
}
const priceRef = (ctx: Ctx_, r: Doc) => tenant(ctx).collection('prices').doc(`${r.categoryId}_${r.washTypeId}`);

// E1: the whole catalog is read inside the transaction, so a racing writer retries on the new state.
function catalogTx<T>(ctx: Ctx_, fn: (c: Cat, tx: Tx) => T): Promise<T> {
  const t = tenant(ctx);
  return db.runTransaction(async (tx) => {
    const [categories, washTypes, prices] = await Promise.all(
      ['categories', 'washTypes', 'prices'].map(async (n) => (await tx.get(t.collection(n))).docs.map((d) => d.data())));
    return fn({ categories, washTypes, prices }, tx);
  });
}

function createCategory(ctx: C, b: Doc) {
  const vt = enabled(ctx, b.vehicleType);
  const ref = tenant(ctx).collection('categories').doc();
  // cars have no cc fields and no overlap rule
  const cat = { id: ref.id, name: name(b.name), active: true, vehicleType: vt, ...(vt === 'car' ? {} : { minCc: b.minCc, maxCc: b.maxCc }) };
  if (vt === 'motorcycle') { int(b.minCc, 0); int(b.maxCc, b.minCc); }
  return catalogTx(ctx, (c, tx) => {
    if (vt === 'motorcycle') noOverlap(cat, c.categories);
    const rows = priceRows(b.prices, c.washTypes.filter((w) => w.vehicleType === vt), (washTypeId) => ({ categoryId: cat.id, washTypeId }));
    complete([...c.categories, cat], c.washTypes, [...c.prices, ...rows]);
    tx.create(ref, cat);
    for (const r of rows) tx.set(priceRef(ctx, r), r);
    return cat;
  });
}

function updateCategory(ctx: Ctx_, b: Doc) {
  return catalogTx(ctx, (c, tx) => {
    const cat = find(c.categories, b.id);
    const ref = tenant(ctx).collection('categories').doc(cat.id);
    if (cat.vehicleType === 'car') {
      tx.update(ref, { name: name(b.name) });
      return { ...cat, name: name(b.name) };
    }
    const next = { ...cat, name: name(b.name), minCc: b.minCc, maxCc: b.maxCc };
    int(b.minCc, 0); int(b.maxCc, b.minCc);
    if (cat.active) noOverlap(next, c.categories);
    tx.update(ref, { name: next.name, minCc: next.minCc, maxCc: next.maxCc });
    return next;
  });
}

function setCategoryActive(ctx: Ctx_, b: Doc) {
  return catalogTx(ctx, (c, tx) => {
    const cat = find(c.categories, b.id);
    if (bool(b.active)) {
      if (cat.vehicleType === 'motorcycle') noOverlap(cat, c.categories);
      complete(swap(c.categories, cat, { ...cat, active: true }), c.washTypes, c.prices);
    }
    tx.update(tenant(ctx).collection('categories').doc(cat.id), { active: b.active });
    return { ...cat, active: b.active };
  });
}

function createWashType(ctx: C, b: Doc) {
  const ref = tenant(ctx).collection('washTypes').doc();
  const type = { id: ref.id, name: name(b.name), active: true, vehicleType: enabled(ctx, b.vehicleType) };
  return catalogTx(ctx, (c, tx) => {
    const rows = priceRows(b.prices, c.categories.filter((x) => x.vehicleType === type.vehicleType), (categoryId) => ({ categoryId, washTypeId: type.id }));
    complete(c.categories, [...c.washTypes, type], [...c.prices, ...rows]);
    tx.create(ref, type);
    for (const r of rows) tx.set(priceRef(ctx, r), r);
    return type;
  });
}

function updateWashType(ctx: Ctx_, b: Doc) {
  return catalogTx(ctx, (c, tx) => {
    const type = find(c.washTypes, b.id);
    const n = name(b.name);
    tx.update(tenant(ctx).collection('washTypes').doc(type.id), { name: n });
    return { ...type, name: n };
  });
}

function setWashTypeActive(ctx: Ctx_, b: Doc) {
  return catalogTx(ctx, (c, tx) => {
    const type = find(c.washTypes, b.id);
    if (bool(b.active)) complete(c.categories, swap(c.washTypes, type, { ...type, active: true }), c.prices);
    tx.update(tenant(ctx).collection('washTypes').doc(type.id), { active: b.active });
    return { ...type, active: b.active };
  });
}

/** Works on inactive items too, so the admin can price before reactivating. */
function setPrice(ctx: Ctx_, b: Doc) {
  return catalogTx(ctx, (c, tx) => {
    find(c.categories, b.categoryId);
    find(c.washTypes, b.washTypeId);
    const row = { categoryId: b.categoryId, washTypeId: b.washTypeId, price: int(b.price, 1) };
    tx.set(priceRef(ctx, row), row);
    return row;
  });
}

// E4: history rows live in subcollections; ids are the zero-padded count so reads come back in order.
const history = async (read: (q: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot>, ref: FirebaseFirestore.DocumentReference) => {
  const [commissionHistory, payFrequencyHistory] = await Promise.all(HISTORY.map(async (n) => (await read(ref.collection(n))).docs.map((d) => plain(d.data()))));
  return { commissionHistory, payFrequencyHistory };
};

async function createWasher(ctx: Ctx_, b: Doc) {
  const ref = tenant(ctx).collection('washers').doc();
  const washer = { id: ref.id, name: name(b.name), commissionBp: int(b.commissionBp, 0, 10000), payFrequency: frequency(b.payFrequency ?? 'biweekly'), active: true };
  await ref.create(washer);
  return { ...washer, commissionHistory: [], payFrequencyHistory: [] };
}

// Omitted fields stay unchanged; a changed bp or frequency appends a history row; orders are never touched.
function updateWasher(ctx: Ctx_, b: Doc, now: Date) {
  return washerTx(ctx, b.id, async (w, h, tx, ref) => {
    const next = { name: name(b.name ?? w.name), commissionBp: int(b.commissionBp ?? w.commissionBp, 0, 10000), payFrequency: frequency(b.payFrequency ?? w.payFrequency) };
    const row = { effectiveFrom: now, changedBy: ctx.uid };
    const add = (n: (typeof HISTORY)[number], extra: Doc) => {
      tx.create(ref.collection(n).doc(String(h[n].length).padStart(6, '0')), { ...extra, ...row });
      h[n] = [...h[n], { ...extra, ...row }];
    };
    if (next.commissionBp !== w.commissionBp) add('commissionHistory', { commissionBp: next.commissionBp });
    if (next.payFrequency !== w.payFrequency) add('payFrequencyHistory', { payFrequency: next.payFrequency });
    tx.update(ref, next);
    return { ...w, ...next };
  });
}

function setWasherActive(ctx: Ctx_, b: Doc) {
  return washerTx(ctx, b.id, async (w, _h, tx, ref) => {
    tx.update(ref, { active: bool(b.active) });
    return { ...w, active: b.active };
  });
}

// Reads the washer and both history lists first (a transaction reads before it writes), then runs `fn`.
function washerTx(ctx: Ctx_, id: unknown, fn: (w: Doc, h: Awaited<ReturnType<typeof history>>, tx: Tx, ref: FirebaseFirestore.DocumentReference) => Promise<Doc>) {
  if (typeof id !== 'string' || !id || id.includes('/')) throw coded('not_found');
  const ref = tenant(ctx).collection('washers').doc(id);
  return db.runTransaction(async (tx) => {
    const [snap, h] = await Promise.all([tx.get(ref), history((q) => tx.get(q), ref)]);
    if (!snap.exists) throw coded('not_found');
    const out = await fn(snap.data()!, h, tx, ref);
    return { ...out, ...h };
  });
}

@Controller('catalog')
export class CatalogController {
  @Post('list')
  @HttpCode(200)
  @Roles('admin', 'operator')
  async list(@Ctx() ctx: Ctx_) {
    const c = await readCatalog(ctx, (q) => q.get());
    if (ctx.role !== 'admin') return c;
    const washers = await Promise.all(c.washers.map(async (w) => ({ ...w, ...(await history((q) => q.get(), tenant(ctx).collection('washers').doc(w.id))) })));
    return { ...c, washers };
  }

  @Post('createCategory') @HttpCode(200) @Roles('admin')
  createCategory(@Ctx() ctx: C, @Body() b: Doc) { return createCategory(ctx, b ?? {}); }

  @Post('updateCategory') @HttpCode(200) @Roles('admin')
  updateCategory(@Ctx() ctx: Ctx_, @Body() b: Doc) { return updateCategory(ctx, b ?? {}); }

  @Post('setCategoryActive') @HttpCode(200) @Roles('admin')
  setCategoryActive(@Ctx() ctx: Ctx_, @Body() b: Doc) { return setCategoryActive(ctx, b ?? {}); }

  @Post('createWashType') @HttpCode(200) @Roles('admin')
  createWashType(@Ctx() ctx: C, @Body() b: Doc) { return createWashType(ctx, b ?? {}); }

  @Post('updateWashType') @HttpCode(200) @Roles('admin')
  updateWashType(@Ctx() ctx: Ctx_, @Body() b: Doc) { return updateWashType(ctx, b ?? {}); }

  @Post('setWashTypeActive') @HttpCode(200) @Roles('admin')
  setWashTypeActive(@Ctx() ctx: Ctx_, @Body() b: Doc) { return setWashTypeActive(ctx, b ?? {}); }

  @Post('setPrice') @HttpCode(200) @Roles('admin')
  setPrice(@Ctx() ctx: Ctx_, @Body() b: Doc) { return setPrice(ctx, b ?? {}); }

  @Post('createWasher') @HttpCode(200) @Roles('admin')
  createWasher(@Ctx() ctx: Ctx_, @Body() b: Doc) { return createWasher(ctx, b ?? {}); }

  @Post('updateWasher') @HttpCode(200) @Roles('admin')
  updateWasher(@Ctx() ctx: Ctx_, @Body() b: Doc, @Req() req: Req_) { return updateWasher(ctx, b ?? {}, clock(req)); }

  @Post('setWasherActive') @HttpCode(200) @Roles('admin')
  setWasherActive(@Ctx() ctx: Ctx_, @Body() b: Doc) { return setWasherActive(ctx, b ?? {}); }
}
