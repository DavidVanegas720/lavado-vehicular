// The P9 wire mapping: the mock's function names and signatures over `call(path, body)`. Pure, no Firebase import.
export const makeApi = (call) => ({
  getSession: () => call('session/get', {}),
  openShift: (input) => call('shifts/open', input),
  getShiftStatus: () => call('shifts/status', {}),
  getClosePreview: (shiftKey) => call('shifts/closePreview', { shiftKey }),
  closeShift: (shiftKey, input) => call('shifts/close', { shiftKey, countedCash: input?.countedCash }),
  reopenShift: (shiftKey, input) => call('shifts/reopen', { shiftKey, reason: input?.reason }),
  listCatalog: () => call('catalog/list', {}),
  createOrder: (input) => call('orders/create', input),
  finishOrder: (orderId, input) => call('orders/finish', { orderId, paymentMethod: input?.paymentMethod }),
  cancelOrder: (orderId, input) => call('orders/cancel', { orderId, reason: input?.reason }),
  listShiftOrders: () => call('orders/listShift', {}),
  listTillPayables: () => call('washerPay/listTillPayables', {}),
  recordTillPayment: (shiftKey, input) =>
    call('washerPay/recordTillPayment', { shiftKey, id: input?.id, washerId: input?.washerId, amount: input?.amount, period: input?.period }),
})
