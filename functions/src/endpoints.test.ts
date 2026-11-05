import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { auth, db } from './firebase.js';
import { emulators, start, token } from './test/harness.js';
import { apiDriver } from './test/driver.js';

const skip = emulators ? false : 'needs the emulators (npm run test:api)';

// Shared contract cases, API driver. Runtime import so tsc does not compile the .js file.
if (emulators) {
  const d = await apiDriver();
  const { default: cases } = await import('../../tests/contracts/cases/shiftsOpen.js' as string);
  cases(d);
  const { default: core } = await import('../../tests/contracts/cases/coreFlow.js' as string);
  core(d);
  const { default: till } = await import('../../tests/contracts/cases/tillPay.js' as string);
  till(d);
  const { default: catalog } = await import('../../tests/contracts/cases/catalog.js' as string);
  catalog(d);
  const { default: operators } = await import('../../tests/contracts/cases/operators.js' as string);
  operators(d);
  const { default: adminShifts } = await import('../../tests/contracts/cases/adminShifts.js' as string);
  adminShifts(d);
  const { default: history } = await import('../../tests/contracts/cases/history.js' as string);
  history(d);
  const { default: washerPayAdmin } = await import('../../tests/contracts/cases/washerPayAdmin.js' as string);
  washerPayAdmin(d);
  const { default: cars } = await import('../../tests/contracts/cases/cars.js' as string);
  cars(d);
  const { default: superadmin } = await import('../../tests/contracts/cases/superadmin.js' as string);
  superadmin(d);
  test.after(() => d.close());
}

test('no token and a token signed by nobody -> 401', { skip }, async () => {
  const s = await start();
  try {
    assert.equal((await s.call('session/get')).status, 401);
    const forged = 'e30.' + Buffer.from(JSON.stringify({ user_id: 'x', role: 'operator' })).toString('base64url') + '.sig';
    assert.equal((await s.call('session/get', forged)).status, 401);
  } finally { await s.close(); }
});

test('stray and inactive accounts get forbidden', { skip }, async () => {
  const s = await start();
  try {
    for (const who of ['stray', 'inactiveB']) {
      for (const path of ['session/get', 'shifts/open']) {
        const r = await s.call(path, s.tokens[who], { openingCash: 0 });
        assert.equal(r.status, 403, `${who} ${path}`);
        assert.deepEqual(await r.json(), { code: 'forbidden' });
      }
    }
  } finally { await s.close(); }
});

test('two parallel opens: exactly one 200; stored event is integer cash at the stamped instant', { skip }, async () => {
  const s = await start();
  try {
    const NOW = '2026-10-29T15:00:00Z';
    const open = () => fetch(`${s.url}/api/shifts/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.tokens.operatorA}`, 'x-test-now': NOW },
      body: JSON.stringify({ openingCash: 50000 }),
    });
    const codes = (await Promise.all([open(), open()])).map((r) => r.status).sort();
    assert.deepEqual(codes, [200, 409]);
    const e = (await db.doc(`businesses/${s.ids.A}/shiftEvents/2026-10-29_unico_open`).get()).data()!;
    assert.equal(e.openingCash, 50000);
    assert.equal(e.at.toMillis(), Date.parse(NOW));
    assert.equal(e.endsAt.toMillis(), Date.parse('2026-10-30T11:00:00Z'));
  } finally { await s.close(); }
});

test('two parallel closes after the end: one 200, one invalid_state, one close doc', { skip }, async () => {
  const s = await start();
  try {
    const at = (iso: string) => ({ 'x-test-now': iso });
    const post = (path: string, iso: string, body: unknown) => fetch(`${s.url}/api/${path}`, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.tokens.operatorA}`, ...at(iso) },
    });
    assert.equal((await post('shifts/open', '2026-10-29T15:00:00Z', { openingCash: 50000 })).status, 200);
    const close = () => post('shifts/close', '2026-10-30T12:00:00Z', { shiftKey: '2026-10-29_unico', countedCash: 50000 });
    const rs = await Promise.all([close(), close()]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await db.collection(`businesses/${s.ids.A}/shiftEvents`).where('type', '==', 'close').get()).size, 1);
  } finally { await s.close(); }
});

test('orders/create: missing id -> validation; 5 parallel creates with one id -> one order, one wash counted', { skip }, async () => {
  const s = await start();
  try {
    const call = (path: string, body: unknown, now: string) => s.call(path, s.tokens.operatorA, body, new Date(now));
    assert.equal((await call('shifts/open', { openingCash: 0 }, '2026-10-29T15:00:00Z')).status, 200);
    const o = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' };
    assert.deepEqual(await (await call('orders/create', o, '2026-10-29T15:00:00Z')).json(), { code: 'validation' });
    const id = randomUUID();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => call('orders/create', { id, ...o }, '2026-10-29T15:00:00Z')));
    assert.deepEqual(rs.map((r) => r.status), [200, 200, 200, 200, 200]);
    assert.equal((await db.collection(`businesses/${s.ids.A}/orders`).get()).size, 1);
    assert.equal((await db.doc(`businesses/${s.ids.A}/vehicles/ABC12D`).get()).data()!.totalWashes, 1);
  } finally { await s.close(); }
});

test('orders/create racing shifts/close: never a stored close with an in_progress order', { skip }, async () => {
  const s = await start();
  try {
    const call = (path: string, body: unknown, now: string) => s.call(path, s.tokens.operatorA, body, new Date(now));
    for (let i = 0; i < 5; i++) {
      const iso = (n: number) => new Date(Date.UTC(2026, 9, 29 + n)).toISOString().slice(0, 10);
      const day = iso(i);
      const key = `${day}_unico`;
      assert.equal((await call('shifts/open', { openingCash: 0 }, `${day}T15:00:00Z`)).status, 200);
      const create = call('orders/create', { id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }, `${day}T16:00:00Z`);
      const close = call('shifts/close', { shiftKey: key, countedCash: 0 }, `${iso(i + 1)}T12:00:00Z`);
      await Promise.all([create, close]);
      const base = `businesses/${s.ids.A}`;
      const closes = (await db.collection(`${base}/shiftEvents`).where('shiftKey', '==', key).where('type', '==', 'close').get()).size;
      const open = (await db.collection(`${base}/orders`).where('shiftKey', '==', key).where('status', '==', 'in_progress').get()).size;
      assert.ok(!(closes && open), `round ${i}: close=${closes} in_progress=${open}`);
    }
  } finally { await s.close(); }
});

test('two parallel payments of the whole balance: one 200, one validation; stored amount is an integer', { skip }, async () => {
  const s = await start();
  try {
    const at = '2026-10-29T15:00:00Z';
    const call = (path: string, body: unknown) => s.call(path, s.tokens.operatorA, body, new Date(at));
    assert.equal((await call('shifts/open', { openingCash: 0 })).status, 200);
    const o = (await (await call('orders/create', { id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' })).json()) as { id: string };
    assert.equal((await call('orders/finish', { orderId: o.id, paymentMethod: 'cash' })).status, 200);
    const pay = () => call('washerPay/recordTillPayment', { shiftKey: '2026-10-29_unico', id: randomUUID(), washerId: 'pedro', amount: 10000, period: 'current' });
    const rs = await Promise.all([pay(), pay()]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 400]);
    const docs = (await db.collection(`businesses/${s.ids.A}/washerPayments`).get()).docs;
    assert.equal(docs.length, 1);
    assert.ok(Number.isInteger(docs[0].data().amount));
  } finally { await s.close(); }
});

// Catalog races (criterion 7): the transaction reads the whole catalog, so the second writer sees the first.
const bodyOf = { prices: { basica: 1000, full: 2000 }, vehicleType: 'motorcycle' };
const catalogCall = (s: Awaited<ReturnType<typeof start>>, path: string, body: unknown) => s.call('catalog/' + path, s.tokens.adminA, body);
const countOf = async (s: Awaited<ReturnType<typeof start>>, c: string) => (await db.collection(`businesses/${s.ids.A}/${c}`).get()).size;

test('two parallel createCategory with overlapping ranges: one 200, one cc_overlap, one new doc', { skip }, async () => {
  const s = await start();
  try {
    const before = await countOf(s, 'categories');
    const rs = await Promise.all([1, 2].map((i) => catalogCall(s, 'createCategory', { name: 'Cat ' + i, minCc: 2001, maxCc: 3000, ...bodyOf })));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    assert.deepEqual(await (rs[0].status === 409 ? rs[0] : rs[1]).json(), { code: 'cc_overlap' });
    assert.equal(await countOf(s, 'categories'), before + 1);
  } finally { await s.close(); }
});

test('parallel setCategoryActive(true) of two overlapping inactive categories: at most one active', { skip }, async () => {
  const s = await start();
  try {
    const ids: string[] = [];
    for (const [i, [min, max]] of [[2001, 2500], [2400, 3000]].entries()) {
      const c = (await (await catalogCall(s, 'createCategory', { name: 'X' + i, minCc: min, maxCc: max, ...bodyOf })).json()) as { id: string };
      // the second one overlaps the first, so park the first before creating it
      if (i === 0) await catalogCall(s, 'setCategoryActive', { id: c.id, active: false });
      ids.push(c.id);
    }
    await catalogCall(s, 'setCategoryActive', { id: ids[1], active: false });
    const rs = await Promise.all(ids.map((id) => catalogCall(s, 'setCategoryActive', { id, active: true })));
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    const active = (await db.collection(`businesses/${s.ids.A}/categories`).where('id', 'in', ids).get()).docs.filter((d) => d.data().active);
    assert.equal(active.length, 1);
  } finally { await s.close(); }
});

// Operators (criterion 4, API-only): the Auth user carries the claims, `disabled` follows `active`, and an old token of a
// deactivated operator is still verified by Auth but denied by the members doc on every route.
test('operators: claims set, disabled follows active, deactivated operator forbidden on every call', { skip }, async () => {
  const s = await start();
  try {
    const admin = (path: string, body: unknown) => s.call(path, s.tokens.adminA, body);
    const mail = 'marta@test.local', pass = 'clave-segura-1';
    const marta = (await (await admin('operators/create', { name: 'Marta', email: mail, password: pass })).json()) as { id: string };
    const user = await auth.getUser(marta.id);
    assert.deepEqual(user.customClaims, { role: 'operator', businessId: s.ids.A });
    assert.equal(user.disabled, false);
    const member = (await db.doc(`businesses/${s.ids.A}/members/${marta.id}`).get()).data()!;
    assert.deepEqual([member.name, member.role, member.active, member.email, member.createdBy], ['Marta', 'operator', true, mail, s.uids.adminA]);
    assert.equal(JSON.stringify(member).includes(pass), false);
    const old = await token(mail, pass); // claims are in the first token
    assert.equal((await s.call('shifts/status', old)).status, 200);
    // Auth step failed after members was written: the old token still verifies, the members doc denies
    await db.doc(`businesses/${s.ids.A}/members/${marta.id}`).update({ active: false });
    for (const path of ['session/get', 'shifts/status', 'shifts/open', 'catalog/list', 'orders/listShift', 'washerPay/listTillPayables']) {
      const r = await s.call(path, old, { openingCash: 0 });
      assert.deepEqual([r.status, await r.json()], [403, { code: 'forbidden' }], path);
    }
    assert.equal((await admin('operators/setActive', { id: marta.id, active: false })).status, 200);
    assert.equal((await auth.getUser(marta.id)).disabled, true);
    await assert.rejects(() => token(mail, pass), /USER_DISABLED/);
    assert.equal((await admin('operators/setActive', { id: marta.id, active: true })).status, 200);
    assert.equal((await auth.getUser(marta.id)).disabled, false);
    assert.equal((await s.call('session/get', await token(mail, pass))).status, 200);
  } finally { await s.close(); }
});

// E17: a disabled Auth user is a permission denial, not a lost session; a forged token stays unauthenticated.
test('guard: deactivated operator token is forbidden, forged token unauthenticated', { skip }, async () => {
  const s = await start();
  try {
    const mail = 'luis@test.local', pass = 'clave-segura-1';
    const r = await s.call('operators/create', s.tokens.adminA, { name: 'Luis', email: mail, password: pass });
    const luis = (await r.json()) as { id: string };
    const old = await token(mail, pass);
    assert.equal((await s.call('operators/setActive', s.tokens.adminA, { id: luis.id, active: false })).status, 200);
    for (const path of ['session/get', 'shifts/open']) {
      const x = await s.call(path, old, { openingCash: 0 });
      assert.deepEqual([x.status, await x.json()], [403, { code: 'forbidden' }], path);
    }
    const f = await s.call('session/get', old.slice(0, -4) + 'AAAA');
    assert.deepEqual([f.status, await f.json()], [401, { code: 'unauthenticated' }]);
  } finally { await s.close(); }
});

// Admin payment races (criterion 7): the transaction reads the washer's payments, so the second writer sees the first.
async function earnedPedro(s: Awaited<ReturnType<typeof start>>) {
  const call = (path: string, body: unknown) => s.call(path, s.tokens.operatorA, body, new Date('2026-10-29T15:00:00Z'));
  await call('shifts/open', { openingCash: 0 });
  const o = (await (await call('orders/create', { id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' })).json()) as { id: string };
  await call('orders/finish', { orderId: o.id, paymentMethod: 'cash' }); // Pedro earns 10000
}
const outsidePay = (s: Awaited<ReturnType<typeof start>>, id: string, amount: number) =>
  s.call('washerPay/recordOutsidePayment', s.tokens.adminA, { id, washerId: 'pedro', amount, period: 'current' }, new Date('2026-10-29T15:00:00Z'));

test('two parallel outside payments of the whole balance with different ids: one 200, one validation, one doc', { skip }, async () => {
  const s = await start();
  try {
    await earnedPedro(s);
    const rs = await Promise.all([randomUUID(), randomUUID()].map((id) => outsidePay(s, id, 10000)));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 400]);
    const docs = (await db.collection(`businesses/${s.ids.A}/washerPayments`).get()).docs;
    assert.deepEqual(docs.map((x) => [x.data().amount, x.data().source]), [[10000, 'outside']]);
  } finally { await s.close(); }
});

test('two parallel outside payments with the same id: both 200, one payment doc', { skip }, async () => {
  const s = await start();
  try {
    await earnedPedro(s);
    const id = randomUUID();
    const rs = await Promise.all([outsidePay(s, id, 4000), outsidePay(s, id, 4000)]);
    assert.deepEqual(rs.map((r) => r.status), [200, 200]);
    assert.equal((await db.collection(`businesses/${s.ids.A}/washerPayments`).get()).size, 1);
  } finally { await s.close(); }
});

test('washerId with a slash is a client error, not internal', { skip }, async () => {
  const s = await start();
  try {
    const now = new Date('2026-10-29T15:00:00Z');
    const bad = 'pedro/commissionHistory/000000';
    const pay = await s.call('washerPay/recordOutsidePayment', s.tokens.adminA, { id: randomUUID(), washerId: bad, amount: 1000, period: 'current' }, now);
    assert.equal(pay.status, 400);
    const ledger = await s.call('washerPay/getLedger', s.tokens.adminA, { washerId: bad }, now);
    assert.equal(ledger.status, 404);
  } finally { await s.close(); }
});

// Billing races (plan 13 criterion 7): payments and fee edits write separate fields inside transactions.
const shifts = [{ id: 'unico', name: 'Turno único', startHour: 6, endHour: 6 }];
const bizDoc = async (s: Awaited<ReturnType<typeof start>>) => (await db.doc(`businesses/${s.ids.A}`).get()).data()!;
const billPay = (s: Awaited<ReturnType<typeof start>>, id: string, paidUntil = '2027-01-01') =>
  s.call('businesses/recordBillingPayment', s.tokens.superadmin, { businessId: s.ids.A, id, amount: 150000, periodMonth: '2026-11', method: 'cash', note: '', paidUntil }, new Date('2026-10-29T15:00:00Z'));
const fee = (s: Awaited<ReturnType<typeof start>>, monthlyFee: number) =>
  s.call('businesses/update', s.tokens.superadmin, { businessId: s.ids.A, name: 'Negocio A', enabledVehicleTypes: ['motorcycle'], monthlyFee, shifts });

test('billing: the same payment id sent twice in parallel is one doc, one result, one paidUntil', { skip }, async () => {
  const s = await start();
  try {
    const id = randomUUID();
    const rs = await Promise.all([billPay(s, id), billPay(s, id)]);
    assert.deepEqual(rs.map((r) => r.status), [200, 200]);
    assert.deepEqual(await rs[0].json(), await rs[1].json());
    assert.equal((await db.collection(`businesses/${s.ids.A}/billingPayments`).get()).size, 1);
    assert.equal((await bizDoc(s)).billing.paidUntil, '2027-01-01');
  } finally { await s.close(); }
});

test('billing: a retry with an older paidUntil under the same id does not overwrite paidUntil', { skip }, async () => {
  const s = await start();
  try {
    const first = randomUUID();
    assert.equal((await billPay(s, first, '2027-01-01')).status, 200);
    assert.equal((await billPay(s, randomUUID(), '2027-03-01')).status, 200);
    assert.equal((await billPay(s, first, '2027-01-01')).status, 200); // replay
    const b = await bizDoc(s);
    assert.equal(b.billing.paidUntil, '2027-03-01');
    assert.equal((await db.collection(`businesses/${s.ids.A}/billingPayments`).get()).size, 2);
  } finally { await s.close(); }
});

test('billing: two parallel fee edits keep one fee; a parallel fee edit and payment keep both fields', { skip }, async () => {
  const s = await start();
  try {
    assert.deepEqual((await Promise.all([fee(s, 111), fee(s, 222)])).map((r) => r.status), [200, 200]);
    let b = await bizDoc(s);
    assert.ok([111, 222].includes(b.billing.monthlyFee));
    assert.equal(b.billing.paidUntil, '2026-11-01');
    const rs = await Promise.all([fee(s, 333), billPay(s, randomUUID())]);
    assert.deepEqual(rs.map((r) => r.status), [200, 200]);
    b = await bizDoc(s);
    assert.deepEqual([b.billing.monthlyFee, b.billing.paidUntil], [333, '2027-01-01']);
  } finally { await s.close(); }
});

test('businesses/create: Auth claims are role admin and the new business id; members doc holds no password', { skip }, async () => {
  const s = await start();
  try {
    const r = await s.call('businesses/create', s.tokens.superadmin, { name: 'Nuevo', enabledVehicleTypes: ['car'], monthlyFee: 1000, paidUntil: '2026-11-30', adminName: 'Jefe', adminEmail: 'jefe@test.local', adminPassword: 'clave-segura-1' });
    const nb = (await r.json()) as { id: string };
    assert.equal(r.status, 200);
    const uid = (await auth.getUserByEmail('jefe@test.local')).uid;
    assert.deepEqual((await auth.getUser(uid)).customClaims, { role: 'admin', businessId: nb.id });
    const m = (await db.doc(`businesses/${nb.id}/members/${uid}`).get()).data()!;
    assert.deepEqual([m.role, m.active, m.createdBy], ['admin', true, s.uids.superadmin]);
    assert.equal(JSON.stringify(m).includes('clave-segura-1'), false);
  } finally { await s.close(); }
});
