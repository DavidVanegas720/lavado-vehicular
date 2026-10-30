import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businesses } from '../../src/mocks/seed.js';
import { signIn } from '../../src/services/session.js';
import { createOrder, listTodayOrders } from '../../src/services/orders.js';
import { listWashers, setWasherCommission } from '../../src/services/catalog.js';

const base = {
  plate: 'abc-12d',
  cc: 150,
  categoryId: 'cat-200',
  washTypeId: 'wt-full',
  washerId: 'w-pedro',
  paymentMethod: 'cash',
  isCourtesy: false,
  courtesyReason: '',
};

test('150 cc, Full, washer at 40%: snapshot has price and commission', async () => {
  await signIn('u-operator-moto');
  const order = await createOrder(base);
  assert.equal(order.plate, 'ABC12D');
  assert.equal(order.listPrice, 25000);
  assert.equal(order.finalPrice, 25000);
  assert.equal(order.commissionBp, 4000);
  assert.equal(order.commissionAmount, 10000);
});

test('a courtesy needs a reason', async () => {
  await signIn('u-operator-moto');
  await assert.rejects(createOrder({ ...base, isCourtesy: true, courtesyReason: '  ' }), {
    code: 'courtesy_reason_required',
  });
});

test('a courtesy charges 0 and still pays commission on the list price', async () => {
  await signIn('u-operator-moto');
  const order = await createOrder({ ...base, isCourtesy: true, courtesyReason: 'cliente frecuente' });
  assert.equal(order.finalPrice, 0);
  assert.equal(order.listPrice, 25000);
  assert.equal(order.commissionAmount, 10000);
});

test('cc outside the chosen category is rejected', async () => {
  await signIn('u-operator-moto');
  await assert.rejects(createOrder({ ...base, cc: 100 }), { code: 'category_mismatch' });
});

test('an invalid plate is rejected', async () => {
  await signIn('u-operator-moto');
  await assert.rejects(createOrder({ ...base, plate: 'ABC123' }), { code: 'validation' });
});

test('a superadmin cannot create orders', async () => {
  await signIn('u-superadmin');
  await assert.rejects(createOrder(base), { code: 'forbidden' });
});

test('a commission change applies only to later orders', async (t) => {
  await signIn('u-admin-moto');
  t.after(() => setWasherCommission('w-pedro', 4000));
  const before = await createOrder(base);
  await setWasherCommission('w-pedro', 5000);
  const after = await createOrder(base);

  const today = await listTodayOrders();
  const stored = new Map(today.map((order) => [order.id, order]));
  assert.equal(stored.get(before.id).commissionAmount, 10000);
  assert.equal(stored.get(before.id).commissionBp, 4000);
  assert.equal(stored.get(after.id).commissionAmount, 12500);
  assert.equal(stored.get(after.id).commissionBp, 5000);
});

test('a blocked business is rejected on every call', async (t) => {
  await signIn('u-operator-moto');
  const biz = businesses.find((b) => b.id === 'biz-moto');
  // shortcut: blocks through the seed until businesses.setStatus exists in A7
  biz.status = 'blocked';
  t.after(() => {
    biz.status = 'active';
  });
  await assert.rejects(createOrder(base), { code: 'business_blocked' });
  await assert.rejects(listTodayOrders(), { code: 'business_blocked' });
  await assert.rejects(listWashers(), { code: 'business_blocked' });
});

test('changing the returned session does not grant permissions', async () => {
  const session = await signIn('u-operator-moto');
  session.role = 'admin';
  await assert.rejects(setWasherCommission('w-pedro', 5000), { code: 'forbidden' });
});

test('missing selections are a validation error', async () => {
  await signIn('u-operator-moto');
  for (const field of ['categoryId', 'washTypeId', 'washerId']) {
    await assert.rejects(createOrder({ ...base, [field]: '' }), { code: 'validation' });
  }
});

test('orders are isolated by business and by operator', async () => {
  await signIn('u-operator-moto');
  const mine = await createOrder(base);
  await signIn('u-admin-moto');
  const theirs = await createOrder(base);

  await signIn('u-operator-moto');
  const own = await listTodayOrders();
  assert.ok(own.some((o) => o.id === mine.id));
  assert.ok(own.every((o) => o.createdBy === 'u-operator-moto'));
  await signIn('u-admin-moto');
  const ids = (await listTodayOrders()).map((o) => o.id);
  assert.ok(ids.includes(mine.id) && ids.includes(theirs.id));

  await signIn('u-admin-mixto');
  assert.deepEqual(await listTodayOrders(), []);
  await assert.rejects(createOrder(base), { code: 'not_found' });
});
