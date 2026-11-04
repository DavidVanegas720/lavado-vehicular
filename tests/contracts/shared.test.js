// Runs every shared case file against the mock (root npm test). functions/src/endpoints.test.ts runs them against the API.
import { mockDriver } from './mockDriver.js'
import shiftsOpenCases from './cases/shiftsOpen.js'
import coreFlowCases from './cases/coreFlow.js'
import tillPayCases from './cases/tillPay.js'
import catalogCases from './cases/catalog.js'
import operatorCases from './cases/operators.js'
import adminShiftCases from './cases/adminShifts.js'
import washerPayAdminCases from './cases/washerPayAdmin.js'
import historyCases from './cases/history.js'

for (const cases of [shiftsOpenCases, coreFlowCases, tillPayCases, catalogCases, operatorCases, adminShiftCases, washerPayAdminCases, historyCases]) {
  cases(mockDriver)
}
