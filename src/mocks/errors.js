// Same codes the backend callables will throw in P9: unauthenticated, forbidden, business_blocked,
// not_found, validation, invalid_state, shift_not_open, shift_closed, price_missing, cc_overlap.
export function coded(code, message = code) {
  return Object.assign(new Error(message), { code })
}
