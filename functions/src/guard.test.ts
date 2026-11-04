import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './guard.js';

const ok = { active: true, status: 'active' };
const c = { role: 'operator', businessId: 'b1' };
const m = { roles: ['operator'] };

test('decide: six outcomes and order', () => {
  assert.equal(decide(c, ok, ok, {}), 'forbidden'); // no @Roles
  assert.equal(decide({}, ok, ok, m), 'forbidden'); // no role claim
  assert.equal(decide({ role: 'superadmin' }, undefined, undefined, { roles: ['superadmin'] }), null);
  assert.equal(decide(c, undefined, ok, m), 'forbidden'); // business missing
  assert.equal(decide(c, ok, undefined, m), 'forbidden'); // member missing
  assert.equal(decide(c, ok, { active: false }, m), 'forbidden');
  assert.equal(decide(c, { status: 'blocked' }, { active: false }, m), 'forbidden'); // inactive wins over blocked
  assert.equal(decide(c, { status: 'blocked' }, ok, m), 'business_blocked');
  assert.equal(decide(c, { status: 'blocked' }, ok, { ...m, allowBlocked: true }), null);
  assert.equal(decide(c, ok, ok, { roles: ['admin'] }), 'forbidden'); // role not listed
  assert.equal(decide(c, ok, ok, m), null);
});
