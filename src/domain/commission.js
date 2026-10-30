// @ts-check

/**
 * Commission in pesos on the list price. Integer math only, rounded half up.
 * @param {number} listPrice integer pesos
 * @param {number} commissionBp integer basis points (4000 = 40%)
 * @returns {number} integer pesos
 */
export function calculateCommission(listPrice, commissionBp) {
  if (!Number.isInteger(listPrice) || !Number.isInteger(commissionBp)) {
    throw new TypeError('commission needs integer pesos and basis points');
  }
  return Math.floor((listPrice * commissionBp + 5000) / 10000);
}
