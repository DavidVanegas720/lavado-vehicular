import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { authorize, signIn, resetMock, setMockNow, listDemoUsers } from '../../src/mocks/session.js'
import { listOperators, createOperator, renameOperator, setOperatorActive } from '../../src/services/operators.js'
import { openShift, getShiftStatus } from '../../src/services/shifts.js'
import { createOrder, listShiftOrders } from '../../src/services/orders.js'
import { listCategories } from '../../src/services/catalog.js'

const code = (c) => (e) => e.code === c
const names = () => listDemoUsers().map((u) => u.name)

beforeEach(() => { resetMock(); setMockNow(new Date('2026-10-29T15:00:00Z')) })

test('admin creates an operator who signs in and opens a shift', () => {
  signIn('ana')
  const marta = createOperator({ name: '  Marta ' })
  assert.deepEqual(marta, { id: marta.id, name: 'Marta', active: true })
  assert.deepEqual(listOperators().map((o) => o.name), ['Carlos', 'Laura', 'Marta'])
  assert.equal(signIn(marta.id).role, 'operator')
  openShift({ openingCash: 0 })
  assert.equal(getShiftStatus().current.state, 'open')
})

test('validation: name 1-60 chars trimmed, active must be boolean', () => {
  signIn('ana')
  for (const bad of [undefined, '', '   ', 'x'.repeat(61), 5]) {
    assert.throws(() => createOperator({ name: bad }), code('validation'))
    assert.throws(() => renameOperator('carlos', bad), code('validation'))
  }
  assert.throws(() => setOperatorActive('carlos', 'no'), code('validation'))
  assert.equal(renameOperator('carlos', 'x'.repeat(60)).name.length, 60)
})

test('deactivated -> forbidden and off the sign-in list; reactivate restores', () => {
  signIn('ana')
  setOperatorActive('laura', false)
  assert.ok(!names().includes('Laura'))
  assert.equal(listOperators().find((o) => o.id === 'laura').active, false)
  assert.throws(() => signIn('laura'), code('forbidden'))
  setOperatorActive('laura', true)
  assert.ok(names().includes('Laura'))
  assert.equal(signIn('laura').name, 'Laura')
})

test('operator and superadmin are forbidden on all four functions', () => {
  for (const who of ['carlos', 'david']) {
    signIn(who)
    assert.throws(() => listOperators(), code('forbidden'))
    assert.throws(() => createOperator({ name: 'X' }), code('forbidden'))
    assert.throws(() => renameOperator('laura', 'X'), code('forbidden'))
    assert.throws(() => setOperatorActive('laura', false), code('forbidden'))
  }
})

test('admin cannot see or touch operators of another business, nor non-operators', () => {
  signIn('ana')
  assert.ok(!listOperators().some((o) => o.id === 'beto'))
  assert.throws(() => renameOperator('beto', 'X'), code('not_found'))
  assert.throws(() => setOperatorActive('beto', false), code('not_found'))
  assert.throws(() => setOperatorActive('ana', false), code('not_found'))
  assert.throws(() => renameOperator('nadie', 'X'), code('not_found'))
})

test('signed in, then deactivated -> forbidden on every call', () => {
  signIn('laura')
  authorize(['operator']).db.users.find((u) => u.id === 'laura').active = false
  for (const call of [() => getShiftStatus(), () => listCategories(), () => createOrder({}), () => listShiftOrders()]) {
    assert.throws(call, code('forbidden'))
  }
})
