import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { authorize, signIn, resetMock, setMockNow, listDemoUsers } from '../../src/mocks/session.js'
import { listOperators, createOperator, renameOperator, setOperatorActive } from '../../src/mocks/operators.js'
import { openShift, getShiftStatus } from '../../src/mocks/shifts.js'
import { createOrder, listShiftOrders } from '../../src/mocks/orders.js'
import { listCategories } from '../../src/mocks/catalog.js'

const code = (c) => (e) => e.code === c
const names = async () => (await listDemoUsers()).map((u) => u.name)

beforeEach(() => { resetMock(); setMockNow(new Date('2026-10-29T15:00:00Z')) })

test('admin creates an operator who signs in and opens a shift', async () => {
  await signIn('ana')
  const marta = await createOperator({ name: '  Marta ' })
  assert.deepEqual(marta, { id: marta.id, name: 'Marta', active: true })
  assert.deepEqual((await listOperators()).map((o) => o.name), ['Carlos', 'Laura', 'Marta'])
  assert.equal((await signIn(marta.id)).role, 'operator')
  await openShift({ openingCash: 0 })
  assert.equal((await getShiftStatus()).current.state, 'open')
})

test('validation: name 1-60 chars trimmed, active must be boolean', async () => {
  await signIn('ana')
  for (const bad of [undefined, '', '   ', 'x'.repeat(61), 5]) {
    await assert.rejects(async () => createOperator({ name: bad }), code('validation'))
    await assert.rejects(async () => renameOperator('carlos', bad), code('validation'))
  }
  await assert.rejects(async () => setOperatorActive('carlos', 'no'), code('validation'))
  assert.equal((await renameOperator('carlos', 'x'.repeat(60))).name.length, 60)
})

test('deactivated -> forbidden and off the sign-in list; reactivate restores', async () => {
  await signIn('ana')
  await setOperatorActive('laura', false)
  assert.ok(!(await names()).includes('Laura'))
  assert.equal((await listOperators()).find((o) => o.id === 'laura').active, false)
  await assert.rejects(async () => signIn('laura'), code('forbidden'))
  await setOperatorActive('laura', true)
  assert.ok((await names()).includes('Laura'))
  assert.equal((await signIn('laura')).name, 'Laura')
})

test('operator and superadmin are forbidden on all four functions', async () => {
  for (const who of ['carlos', 'david']) {
    await signIn(who)
    await assert.rejects(async () => listOperators(), code('forbidden'))
    await assert.rejects(async () => createOperator({ name: 'X' }), code('forbidden'))
    await assert.rejects(async () => renameOperator('laura', 'X'), code('forbidden'))
    await assert.rejects(async () => setOperatorActive('laura', false), code('forbidden'))
  }
})

test('admin cannot see or touch operators of another business, nor non-operators', async () => {
  await signIn('ana')
  assert.ok(!(await listOperators()).some((o) => o.id === 'beto'))
  await assert.rejects(async () => renameOperator('beto', 'X'), code('not_found'))
  await assert.rejects(async () => setOperatorActive('beto', false), code('not_found'))
  await assert.rejects(async () => setOperatorActive('ana', false), code('not_found'))
  await assert.rejects(async () => renameOperator('nadie', 'X'), code('not_found'))
})

test('signed in, then deactivated -> forbidden on every call', async () => {
  await signIn('laura')
  authorize(['operator']).db.users.find((u) => u.id === 'laura').active = false
  for (const call of [() => getShiftStatus(), () => listCategories(), () => createOrder({}), () => listShiftOrders()]) {
    await assert.rejects(call, code('forbidden'))
  }
})
