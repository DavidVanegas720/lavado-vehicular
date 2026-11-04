import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { getShiftStatus, openShift, closeShift, reopenShift } from '../../src/mocks/shifts.js'

const DAY1 = new Date('2026-10-29T15:00:00Z') // 10:00 Bogota, shift 2026-10-29_unico, ends 06:00 next day
const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_unico'

beforeEach(() => { resetMock(); setMockNow(DAY1) })

test('open twice -> invalid_state; bad base -> validation', async () => {
  await signIn('carlos')
  await assert.rejects(async () => openShift({ openingCash: -1 }), code('validation'))
  await assert.rejects(async () => openShift({ openingCash: 1.5 }), code('validation'))
  await openShift({ openingCash: 50000 })
  assert.equal((await getShiftStatus()).current.state, 'open')
  await signIn('laura')
  await assert.rejects(async () => openShift({ openingCash: 0 }), code('invalid_state'))
})

test('admin and superadmin get forbidden on open, close and reopen', async () => {
  for (const who of ['ana', 'david']) {
    await signIn(who)
    await assert.rejects(async () => openShift({ openingCash: 0 }), code('forbidden'))
    await assert.rejects(async () => closeShift(KEY, { countedCash: 0 }), code('forbidden'))
    await assert.rejects(async () => reopenShift(KEY, { reason: 'x' }), code('forbidden'))
  }
})
