import { MOCK, api } from '../api/client.js'
import * as mock from '../mocks/shifts.js'

export const { getShiftStatus, openShift, closeShift, reopenShift, getClosePreview } = MOCK ? mock : api
export { listShiftInstances, getShiftInstance } from '../mocks/shifts.js'
