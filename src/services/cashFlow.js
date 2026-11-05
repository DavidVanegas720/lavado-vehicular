import { MOCK, api } from '../api/client.js'
import { getCashFlow as mock } from '../mocks/cashFlow.js'

export const getCashFlow = MOCK ? mock : api.getCashFlow
