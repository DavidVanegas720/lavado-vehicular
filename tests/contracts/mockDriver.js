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
import * as biz from '../../src/mocks/businesses.js'

const DAY1 = new Date('2026-10-29T15:00:00Z') // 10:00 Bogota, shift 2026-10-29_unico, ends 06:00 next day
const MOCK_USERS = {
  operator: 'carlos', operator2: 'laura', admin: 'ana', superadmin: 'david', otherOperator: 'beto', blockedOperator: 'bloqueado', otherAdmin: 'pa',
}
const BUSINESS_IDS = { A: 'medallo', B: 'prueba', C: 'bloqueado' }
// F11: one fixed date picture with clock DAY1, plus an admin for business B
const PAID_UNTIL = { medallo: '2026-11-01', prueba: '2027-12-01', bloqueado: '2026-10-01' }

export const mockDriver = {
  reset: async () => {
    resetMock((db) => {
      for (const b of db.businesses) b.billing.paidUntil = PAID_UNTIL[b.id]
      db.users.push({ id: 'pa', name: 'Admin Prueba', role: 'admin', businessId: 'prueba', active: true })
    })
    setMockNow(DAY1)
  },
  businessIdOf: (k) => BUSINESS_IDS[k],
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
  listBusinesses: biz.listBusinesses, createBusiness: biz.createBusiness, updateBusiness: biz.updateBusiness,
  recordBillingPayment: biz.recordBillingPayment, listBillingPayments: biz.listBillingPayments,
  setBusinessBlocked: biz.setBusinessBlocked, setAlertWindowDays: biz.setAlertWindowDays,
}
