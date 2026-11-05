import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { APP_GUARD } from '@nestjs/core/constants.js';
import { AppModule } from './app.module.js';
import { AuthGuard } from './guard.js';
import { db } from './firebase.js';
import { dump, emulators, PROJECT, SENTINEL, start } from './test/harness.js';

const src = join(fileURLToPath(import.meta.url), '../../src');
const skip = emulators ? false : 'needs the emulators (npm run test:api)';

type Ctl = new (...a: never[]) => object;
const norm = (p: string) => p.replace(/^\/+|\/+$/g, '');
const controllers: Ctl[] = Reflect.getMetadata('controllers', AppModule) ?? [];
// Every route as [path, handler] — the table tests 2 and 3 iterate.
const routes = controllers.flatMap((c) =>
  Object.getOwnPropertyNames(c.prototype)
    .filter((n) => n !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, c.prototype[n as keyof object]))
    .map((n) => {
      const h = c.prototype[n as keyof object];
      return { path: `${norm(Reflect.getMetadata(PATH_METADATA, c))}/${norm(Reflect.getMetadata(PATH_METADATA, h))}`, handler: h };
    }));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'domain' || f === 'test' ? [] : files(p);
    return [p];
  });
}

test('1. no collection-group queries in functions/src', () => {
  const needle = 'collection' + 'Group'; // built apart so this file does not match itself
  const bad = files(src).filter((f) => !f.endsWith('.test.ts') && readFileSync(f, 'utf8').includes(needle));
  assert.deepEqual(bad, []);
});

test('2a. every route has Roles metadata; AuthGuard is the APP_GUARD', () => {
  for (const r of routes) assert.ok(Reflect.getMetadata('roles', r.handler)?.length, `${r.path} lacks @Roles`);
  const providers: { provide?: unknown; useClass?: unknown }[] = Reflect.getMetadata('providers', AppModule);
  assert.ok(providers.some((p) => p.provide === APP_GUARD && p.useClass === AuthGuard));
});

test('2c. the route list and each route\'s roles are exactly the plan\'s (10-p8 R1)', () => {
  const plan: Record<string, string[]> = { 'session/get': ['admin', 'operator', 'superadmin'], 'shifts/open': ['operator'],
    'shifts/status': ['admin', 'operator'], 'shifts/closePreview': ['operator'], 'shifts/close': ['operator'], 'shifts/reopen': ['operator'],
    'catalog/list': ['admin', 'operator'], 'orders/create': ['operator'], 'orders/finish': ['admin', 'operator'],
    'orders/cancel': ['admin', 'operator'], 'orders/listShift': ['operator'],
    'washerPay/listTillPayables': ['operator'], 'washerPay/recordTillPayment': ['operator'],
    ...Object.fromEntries(['createCategory', 'updateCategory', 'setCategoryActive', 'createWashType', 'updateWashType', 'setWashTypeActive', 'setPrice',
      'createWasher', 'updateWasher', 'setWasherActive'].map((n) => ['catalog/' + n, ['admin']])),
    'washerPay/listBalances': ['admin'], 'washerPay/getLedger': ['admin'], 'washerPay/recordOutsidePayment': ['admin'], 'washerPay/recordCorrection': ['admin'], 'cashFlow/get': ['admin'],
    'shifts/listInstances': ['admin'], 'shifts/getInstance': ['admin'], 'history/getPlate': ['admin'],
    ...Object.fromEntries(['list', 'create', 'rename', 'setActive'].map((n) => ['operators/' + n, ['admin']])),
    ...Object.fromEntries(['list', 'create', 'update', 'setBlocked', 'setAlertWindowDays', 'listBillingPayments', 'recordBillingPayment'].map((n) => ['businesses/' + n, ['superadmin']])),
  };
  assert.deepEqual(routes.map((r) => r.path).sort(), Object.keys(plan).sort());
  for (const r of routes) assert.deepEqual([...Reflect.getMetadata('roles', r.handler)].sort(), plan[r.path], r.path);
});

test('2b. every route without a token is 401 unauthenticated', { skip }, async () => {
  const s = await start();
  try {
    for (const r of routes) {
      const res = await s.call(r.path);
      assert.equal(res.status, 401, r.path);
      assert.deepEqual(await res.json(), { code: 'unauthenticated' });
    }
  } finally { await s.close(); }
});

test('3. an A user cannot read or change business B', { skip }, async () => {
  const s = await start();
  try {
    const refB = db.doc(`businesses/${s.ids.B}`);
    const before = await dump(refB);
    for (const r of routes) {
      for (const who of ['adminA', 'operatorA']) {
        const res = await s.call(r.path, s.tokens[who], { businessId: s.ids.B });
        assert.ok(!(await res.text()).includes(SENTINEL), `${r.path} leaked B to ${who}`);
      }
    }
    assert.deepEqual(await dump(refB), before);
  } finally { await s.close(); }
});

test('4. rules deny clients: GET and PATCH on a business doc are 403; blocked, root and car reads too', { skip }, async () => {
  const s = await start();
  try {
    const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
    const hdr = (who: string) => ({ authorization: `Bearer ${s.tokens[who]}`, 'content-type': 'application/json' });
    const u = `${base}/businesses/${s.ids.A}`;
    const headers = hdr('adminA');
    assert.equal((await fetch(u, { headers })).status, 403);
    assert.equal((await fetch(`${u}?updateMask.fieldPaths=name`, { method: 'PATCH', headers, body: JSON.stringify({ fields: { name: { stringValue: 'x' } } }) })).status, 403);
    assert.equal((await fetch(`${base}/businesses/${s.ids.C}`, { headers: hdr('operatorC') })).status, 403);
    assert.equal((await fetch(`${base}/platform/settings`, { headers: hdr('superadmin') })).status, 403);
    assert.equal((await fetch(`${base}/businesses/${s.ids.B}/categories/p-auto`, { headers: hdr('operatorB') })).status, 403);
  } finally { await s.close(); }
});


test('5. blocked business: every route but session/get is 403 business_blocked (superadmin routes too); unblock restores the data', { skip }, async () => {
  const s = await start();
  try {
    const refA = db.doc(`businesses/${s.ids.A}`);
    const { _: _doc, ...before } = (await dump(refA)) as Record<string, unknown>;
    const setBlocked = (blocked: boolean) => s.call('businesses/setBlocked', s.tokens.superadmin, { businessId: s.ids.A, blocked, reason: 'Sin pago' });
    assert.equal((await setBlocked(true)).status, 200);
    for (const who of ['adminA', 'operatorA']) {
      for (const r of routes.filter((x) => x.path !== 'session/get')) {
        const res = await s.call(r.path, s.tokens[who], { businessId: s.ids.A, openingCash: 0 });
        assert.deepEqual([res.status, await res.json()], [403, { code: 'business_blocked' }], `${who} ${r.path}`);
      }
      const ses = await s.call('session/get', s.tokens[who]);
      assert.deepEqual([ses.status, ((await ses.json()) as { businessBlocked: boolean }).businessBlocked], [200, true]);
    }
    assert.equal((await setBlocked(false)).status, 200);
    const { _: _after, ...after } = (await dump(refA)) as Record<string, unknown>;
    assert.deepEqual(after, before);
  } finally { await s.close(); }
});

test('6. admins and operators never see billing data on any route they can call', { skip }, async () => {
  const s = await start();
  try {
    for (const who of ['adminA', 'operatorA']) {
      const role = who.startsWith('admin') ? 'admin' : 'operator';
      for (const r of routes.filter((x) => Reflect.getMetadata('roles', x.handler).includes(role))) {
        const body = await (await s.call(r.path, s.tokens[who], {})).text();
        assert.ok(!/paidUntil|monthlyFee|billing/.test(body), `${r.path} leaked billing to ${who}`);
      }
    }
  } finally { await s.close(); }
});
