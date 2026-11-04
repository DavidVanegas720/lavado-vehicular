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

test('4. rules deny clients: GET and PATCH on a business doc are 403', { skip }, async () => {
  const s = await start();
  try {
    const u = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/businesses/${s.ids.A}`;
    const headers = { authorization: `Bearer ${s.tokens.adminA}`, 'content-type': 'application/json' };
    assert.equal((await fetch(u, { headers })).status, 403);
    assert.equal((await fetch(`${u}?updateMask.fieldPaths=name`, { method: 'PATCH', headers, body: JSON.stringify({ fields: { name: { stringValue: 'x' } } }) })).status, 403);
  } finally { await s.close(); }
});
