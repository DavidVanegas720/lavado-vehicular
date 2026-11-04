import { MOCK, api } from '../api/client.js'
import * as mock from '../mocks/washerPay.js'

export const { listTillPayables, recordTillPayment } = MOCK ? mock : api
export { listWasherBalances, getWasherLedger, recordOutsidePayment, recordCorrection } from '../mocks/washerPay.js'
