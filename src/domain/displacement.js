// @ts-check

/**
 * @typedef {{ id: string, ccMin: number, ccMax: number }} CcCategory
 */

/**
 * Returns the category whose cc range contains `cc`, or null.
 * @param {number} cc
 * @param {CcCategory[]} categories
 * @returns {CcCategory | null}
 */
export function categoryForCc(cc, categories) {
  return categories.find((category) => cc >= category.ccMin && cc <= category.ccMax) ?? null;
}
