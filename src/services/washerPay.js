import { MOCK, api } from '../api/client.js'
import * as mock from '../mocks/washerPay.js'

export const {
  listTillPayables, recordTillPayment, listWasherBalances, getWasherLedger, recordOutsidePayment, recordCorrection,
} = MOCK ? mock : api
