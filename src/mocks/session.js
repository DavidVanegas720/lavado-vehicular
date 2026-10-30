import { businesses, users } from './seed.js';
import { coded } from './errors.js';

let current = null;

// shortcut: demo sign-in by user id, no password; replaced by Firebase Auth in B1
export function listDemoUsers() {
  return structuredClone(users);
}

export async function signIn(userId) {
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) throw coded('not_found', 'user not found');
  current = { ...user, business: businesses.find((b) => b.id === user.businessId) ?? null };
  return structuredClone(current);
}

export async function signOut() {
  current = null;
}

// Every mock service calls this first. Views never get to decide who may act.
export function requireSession(allowedRoles) {
  if (!current || !allowedRoles.includes(current.role)) throw coded('forbidden');
  if (current.business?.status === 'blocked') throw coded('business_blocked');
  return current;
}
