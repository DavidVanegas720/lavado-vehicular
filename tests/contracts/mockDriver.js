// Mock driver for the shared contract cases (tests/contracts/cases): same keys and clock as functions/src/test/driver.ts.
import { signIn, signInWithEmail, getSession, resetMock, setMockNow } from '../../src/mocks/session.js'
import { getShiftStatus, openShift, closeShift, reopenShift, getClosePreview, listShiftInstances, getShiftInstance } from '../../src/mocks/shifts.js'
import { createOrder, finishOrder, cancelOrder, listShiftOrders } from '../../src/mocks/orders.js'
import * as catalog from '../../src/mocks/catalog.js'
import { listOperators, createOperator, renameOperator, setOperatorActive } from '../../src/mocks/operators.js'
import {
  listTillPayables, recordTillPayment, listWasherBalances, getWasherLedger, recordOutsidePayment, recordCorrection,
} from '../../src/mocks/washerPay.js'
import { getCashFlow } from '../../src/mocks/cashFlow.js'
import { getPlateHistory } from '../../src/mocks/history.js'

const DAY1 = new Date('2026-10-29T15:00:00Z') // 10:00 Bogota, shift 2026-10-29_unico, ends 06:00 next day
const MOCK_USERS = {
  operator: 'carlos', operator2: 'laura', admin: 'ana', superadmin: 'david', otherOperator: 'beto', blockedOperator: 'bloqueado',
}

export const mockDriver = {
  reset: async () => { resetMock(); setMockNow(DAY1) },
  as: (key) => signIn(MOCK_USERS[key]),
  at: setMockNow,
  idOf: (key) => MOCK_USERS[key],
  signInWith: (email) => signInWithEmail(email), // the mock keeps no password
  sessionGet: () => getSession(),
  openShift, getShiftStatus, getClosePreview, closeShift, reopenShift, listShiftInstances, getShiftInstance,
  createOrder, finishOrder, cancelOrder, listShiftOrders,
  listCatalog: catalog.listCatalog,
  createCategory: catalog.createCategory, updateCategory: catalog.updateCategory, setCategoryActive: catalog.setCategoryActive,
  createWashType: catalog.createWashType, updateWashType: catalog.updateWashType, setWashTypeActive: catalog.setWashTypeActive,
  setPrice: catalog.setPrice, createWasher: catalog.createWasher, updateWasher: catalog.updateWasher, setWasherActive: catalog.setWasherActive,
  listOperators, createOperator, renameOperator, setOperatorActive,
  listTillPayables, recordTillPayment, listWasherBalances, getWasherLedger, recordOutsidePayment, recordCorrection,
  getCashFlow, getPlateHistory,
}
