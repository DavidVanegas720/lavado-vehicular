// @ts-check

export const ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
});

export const ROLE_LABELS = Object.freeze({
  superadmin: 'Superadministrador',
  admin: 'Dueño',
  operator: 'Operador',
});

// Must match the paths in router/nav.js.
const HOME_BY_ROLE = Object.freeze({
  superadmin: '/businesses',
  admin: '/cash-close',
  operator: '/new-wash',
});

/**
 * @param {string} role
 * @param {string[]} allowedRoles
 * @returns {boolean}
 */
export function canAccess(role, allowedRoles) {
  return allowedRoles.includes(role);
}

/**
 * @param {string} role
 * @returns {string}
 */
export function homeRouteFor(role) {
  return HOME_BY_ROLE[/** @type {keyof typeof HOME_BY_ROLE} */ (role)];
}
