import { MOCK, api } from '../api/client.js'
import * as mock from '../mocks/orders.js'

export const { createOrder, finishOrder, cancelOrder, listShiftOrders } = MOCK ? mock : api
