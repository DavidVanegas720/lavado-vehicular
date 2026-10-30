import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, canAccess, homeRouteFor } from '../../src/domain/roles.js';

test('canAccess allows only the listed roles', () => {
  assert.equal(canAccess(ROLES.ADMIN, [ROLES.ADMIN]), true);
  assert.equal(canAccess(ROLES.OPERATOR, [ROLES.ADMIN]), false);
});

test('every role has a home route', () => {
  for (const role of Object.values(ROLES)) {
    assert.ok(homeRouteFor(role), `no home route for ${role}`);
  }
});
