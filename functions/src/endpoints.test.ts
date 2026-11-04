import test from 'node:test';
import assert from 'node:assert/strict';
import { coded } from './errors.js';
import { db } from './firebase.js';
import { emulators, start } from './test/harness.js';

const skip = emulators ? false : 'needs the emulators (npm run test:api)';
const KEYS: Record<string, string> = { operator: 'operatorA', admin: 'adminA', superadmin: 'superadmin', blockedOperator: 'operatorC' };

// Shared contract cases, API driver. Runtime import so tsc does not compile the .js file.
if (emulators) {
  let s: Awaited<ReturnType<typeof start>> | undefined;
  let who = '';
  const send = async (path: string, body: unknown = {}) => {
    const r = await s!.call(path, s!.tokens[KEYS[who]], body);
    const json = await r.json();
    if (!r.ok) throw coded((json as { code: string }).code);
    return json;
  };
  const { default: cases } = await import('../../tests/contracts/cases/shiftsOpen.js' as string);
  cases({
    reset: async () => { await s?.close(); s = await start(); },
    as: async (k: string) => { who = k; },
    sessionGet: () => send('session/get'),
    openShift: (input: unknown) => send('shifts/open', input),
  });
  test.after(() => s?.close());
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
