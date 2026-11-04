import test from 'node:test';
import assert from 'node:assert/strict';
import { tenant } from './firebase.js';
import { coded, ErrorFilter } from './errors.js';

function run(err: unknown) {
  let out: { status?: number; body?: unknown } = {};
  const res = { status: (s: number) => ((out.status = s), res), json: (b: unknown) => ((out.body = b), res) };
  new ErrorFilter().catch(err, { switchToHttp: () => ({ getResponse: () => res }) } as never);
  return out;
}

test('tenant path', () => assert.equal(tenant({ businessId: 'b1' }).path, 'businesses/b1'));
test('coded validation -> 400', () => assert.deepEqual(run(coded('validation')), { status: 400, body: { code: 'validation' } }));
test('other code -> 409', () => assert.equal(run(coded('shift_closed')).status, 409));
test('plain Error -> 500 without message', () => {
  const o = run(new Error('boom'));
  assert.deepEqual(o, { status: 500, body: { code: 'internal' } });
});
