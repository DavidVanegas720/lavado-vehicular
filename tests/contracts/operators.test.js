// Mock-only: needs the mock's internals (flips a signed-in user to inactive). Everything else is in cases/operators.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { authorize, signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { getShiftStatus } from '../../src/mocks/shifts.js'
import { createOrder, listShiftOrders } from '../../src/mocks/orders.js'
import { listCategories } from '../../src/mocks/catalog.js'

const code = (c) => (e) => e.code === c

test('signed in, then deactivated -> forbidden on every call', async () => {
  resetMock(); setMockNow(new Date('2026-10-29T15:00:00Z'))
  await signIn('laura')
  authorize(['operator']).db.users.find((u) => u.id === 'laura').active = false
  for (const call of [() => getShiftStatus(), () => listCategories(), () => createOrder({}), () => listShiftOrders()]) {
    await assert.rejects(call, code('forbidden'))
  }
})
