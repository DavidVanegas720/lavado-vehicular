import { MOCK, api } from '../api/client.js'
import * as mock from '../mocks/businesses.js'

export const {
  listBusinesses, createBusiness, updateBusiness, recordBillingPayment, listBillingPayments,
  setBusinessBlocked, setAlertWindowDays,
} = MOCK ? mock : api
