import { MOCK, api } from '../api/client.js'
import { getPlateHistory as mock } from '../mocks/history.js'

export const getPlateHistory = MOCK ? mock : api.getPlateHistory
