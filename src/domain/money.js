// @ts-check

const formatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * @param {number} pesos integer pesos
 * @returns {string} e.g. "$ 25.000"
 */
export function formatCOP(pesos) {
  return formatter.format(pesos);
}
