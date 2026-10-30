// @ts-check

const PATTERNS = Object.freeze({
  car: /^[A-Z]{3}\d{3}$/,
  motorcycle: /^[A-Z]{3}\d{2}[A-Z]?$/,
});

/**
 * Uppercases a plate and strips spaces and dashes.
 * @param {string} raw
 * @returns {string}
 */
export function normalizePlate(raw) {
  return String(raw).toUpperCase().replace(/[\s-]/g, '');
}

/**
 * @param {string} plate normalized plate
 * @param {'car' | 'motorcycle'} vehicleType
 * @returns {boolean}
 */
export function validatePlate(plate, vehicleType) {
  return PATTERNS[vehicleType]?.test(plate) ?? false;
}
