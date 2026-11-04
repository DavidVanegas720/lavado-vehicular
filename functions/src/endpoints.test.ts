import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from './firebase.js';
import { emulators, start } from './test/harness.js';
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
    for (const who of ['stray', 'inactiveA']) {
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
