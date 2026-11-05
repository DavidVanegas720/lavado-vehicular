// Shared cases for the P2 operator admin. driver: { reset(), as(key), signInWith(email, password), idOf(key), openShift,
// getShiftStatus, listOperators, createOperator, renameOperator, setOperatorActive }.
// Keys: operator (Carlos), operator2 (Laura), admin, superadmin, otherOperator (business B).
import test from 'node:test'
import assert from 'node:assert/strict'

const code = (c) => (e) => e.code === c
const MARTA = { name: '  Marta ', email: 'marta@test.local', password: 'clave-segura-1' }
const names = async (d) => (await d.listOperators()).map((o) => o.name).sort()

export default function operatorCases(d) {
  test('admin creates an operator who signs in and opens a shift; same email again -> email_taken', async () => {
    await d.reset(); await d.as('admin')
    const marta = await d.createOperator(MARTA)
    assert.deepEqual(marta, { id: marta.id, name: 'Marta', active: true, email: 'marta@test.local' })
    assert.deepEqual(await names(d), ['Carlos', 'Laura', 'Marta'])
    await assert.rejects(() => d.createOperator({ ...MARTA, name: 'Otra' }), code('email_taken'))
    await assert.rejects(() => d.createOperator({ ...MARTA, name: 'Otra', email: 'MARTA@test.local' }), code('email_taken'))
    await d.signInWith('marta@test.local', 'clave-segura-1')
    await d.openShift({ openingCash: 0 })
    assert.equal((await d.getShiftStatus()).current.state, 'open')
  })

  test('validation: name 1-60 chars trimmed, email, password 8-128, active must be boolean', async () => {
    await d.reset(); await d.as('admin')
    const carlos = await d.idOf('operator')
    for (const bad of [undefined, '', '   ', 'x'.repeat(61), 5]) {
      await assert.rejects(() => d.createOperator({ ...MARTA, name: bad }), code('validation'))
      await assert.rejects(() => d.renameOperator(carlos, bad), code('validation'))
    }
    for (const bad of [undefined, '', 'nope', 'a@b', 5]) await assert.rejects(() => d.createOperator({ ...MARTA, email: bad }), code('validation'))
    for (const bad of [undefined, '1234567', 'x'.repeat(129), 12345678]) await assert.rejects(() => d.createOperator({ ...MARTA, password: bad }), code('validation'))
    await assert.rejects(() => d.setOperatorActive(carlos, 'no'), code('validation'))
    assert.equal((await d.renameOperator(carlos, 'x'.repeat(60))).name.length, 60)
    assert.deepEqual(await names(d), ['Laura', 'x'.repeat(60)])
  })

  test('operator password of exactly 8 chars is still accepted (G6)', async () => {
    await d.reset(); await d.as('admin')
    assert.equal((await d.createOperator({ ...MARTA, password: '12345678' })).name, 'Marta')
  })

  test('deactivated -> sign-in forbidden; reactivate restores', async () => {
    await d.reset(); await d.as('admin')
    const marta = await d.createOperator(MARTA)
    await d.setOperatorActive(marta.id, false)
    assert.equal((await d.listOperators()).find((o) => o.id === marta.id).active, false)
    await assert.rejects(() => d.signInWith('marta@test.local', 'clave-segura-1'), code('forbidden'))
    await d.as('admin')
    await d.setOperatorActive(marta.id, true)
    await d.signInWith('marta@test.local', 'clave-segura-1')
    await d.openShift({ openingCash: 0 })
  })

  test('operator and superadmin are forbidden on all four functions', async () => {
    await d.reset()
    const laura = await d.idOf('operator2')
    for (const who of ['operator', 'superadmin']) {
      await d.as(who)
      await assert.rejects(() => d.listOperators(), code('forbidden'))
      await assert.rejects(() => d.createOperator(MARTA), code('forbidden'))
      await assert.rejects(() => d.renameOperator(laura, 'X'), code('forbidden'))
      await assert.rejects(() => d.setOperatorActive(laura, false), code('forbidden'))
    }
  })

  test('admin cannot see or touch operators of another business, nor non-operators', async () => {
    await d.reset(); await d.as('admin')
    const beto = await d.idOf('otherOperator')
    const ana = await d.idOf('admin')
    assert.ok(!(await d.listOperators()).some((o) => o.id === beto))
    await assert.rejects(() => d.renameOperator(beto, 'X'), code('not_found'))
    await assert.rejects(() => d.setOperatorActive(beto, false), code('not_found'))
    await assert.rejects(() => d.setOperatorActive(ana, false), code('not_found'))
    await assert.rejects(() => d.renameOperator('nadie', 'X'), code('not_found'))
  })
}
