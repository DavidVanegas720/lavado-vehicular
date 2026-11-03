// @ts-check

const STANDARD = { car: /^[A-Z]{3}\d{3}$/, motorcycle: /^[A-Z]{3}\d{2}[A-Z]?$/ }
const SPECIAL = /^[A-Z0-9]{2,10}$/

/**
 * Normalizes and validates a plate. Returns null when invalid.
 * A ticked special plate that matches the standard format is stored as standard.
 * @param {string} raw
 * @param {'car' | 'motorcycle'} vehicleType
 * @param {boolean} special
 * @returns {{ plate: string, plateSpecial: boolean } | null}
 */
export function parsePlate(raw, vehicleType, special) {
  const plate = String(raw ?? '').toUpperCase().replace(/[\s-]/g, '')
  if (STANDARD[vehicleType]?.test(plate)) return { plate, plateSpecial: false }
  if (special && SPECIAL.test(plate)) return { plate, plateSpecial: true }
  return null
}
