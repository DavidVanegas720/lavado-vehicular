// Texts for error codes. Views pass overrides for their own context (e.g. NewWash's not_found).
export const MESSAGES = {
  forbidden: 'No tenés permiso para esto.',
  business_blocked: 'La cuenta del negocio está suspendida. Contactá a soporte.',
  invalid_state: 'Esta orden ya cambió. Actualizamos la lista.',
  shift_closed: 'Ese turno ya se cerró. Pedile a un operador que lo reabra.',
  shift_not_open: 'El turno no está abierto.',
  price_missing: 'Falta el precio de alguna combinación. Completá los precios.',
  cc_overlap: 'Ese rango de cilindraje se cruza con otra categoría activa.',
  validation: 'Escribí una placa válida (letras y números, 2 a 10 caracteres).',
  not_found: 'Ese registro ya no existe. Actualizamos la lista.',
}

export function errorText(e, overrides = {}) {
  return overrides[e.code] ?? MESSAGES[e.code] ?? 'No se pudo completar la acción. Intentá de nuevo.'
}
