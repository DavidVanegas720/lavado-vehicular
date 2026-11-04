// Shared cases for session/get and shifts/open. driver: { reset(), as(key), sessionGet(), openShift(input) }
// keys: operator, admin, superadmin, blockedOperator. Run by the mock driver (root npm test) and the API driver (npm run test:api).
import test from 'node:test'
import assert from 'node:assert/strict'

const code = (c) => (e) => e.code === c

export default function shiftsOpenCases(d) {
  test('session/get returns exactly the public fields for an operator', async () => {
    await d.reset(); await d.as('operator')
    const s = await d.sessionGet()
    assert.deepEqual(Object.keys(s).sort(), ['businessBlocked', 'businessId', 'businessName', 'enabledVehicleTypes', 'name', 'role', 'uid'])
    assert.equal(s.role, 'operator')
    assert.equal(s.businessBlocked, false)
    assert.equal(typeof s.businessName, 'string')
  })

  test('openShift: 1.5 and "50000" -> validation; open then open -> invalid_state', async () => {
    await d.reset(); await d.as('operator')
    await assert.rejects(() => d.openShift({ openingCash: 1.5 }), code('validation'))
    await assert.rejects(() => d.openShift({ openingCash: '50000' }), code('validation'))
    await d.openShift({ openingCash: 50000 })
    await assert.rejects(() => d.openShift({ openingCash: 0 }), code('invalid_state'))
  })

  test('admin and superadmin cannot open a shift', async () => {
    await d.reset()
    for (const who of ['admin', 'superadmin']) {
      await d.as(who)
      await assert.rejects(() => d.openShift({ openingCash: 0 }), code('forbidden'))
    }
  })

  test('operator of a blocked business: session/get says blocked, open -> business_blocked', async () => {
    await d.reset(); await d.as('blockedOperator')
    assert.equal((await d.sessionGet()).businessBlocked, true)
    await assert.rejects(() => d.openShift({ openingCash: 0 }), code('business_blocked'))
  })
}
