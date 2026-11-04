import type { AddressInfo } from 'node:net';
import { createApp } from '../index.js';
import { auth, db } from '../firebase.js';

export const PROJECT = 'demo-lavadero';
export const SENTINEL = 'NEGOCIO-B-SENTINEL';
export const emulators = !!(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const PASSWORD = 'test-password-1';

// key -> [business, role, active]; claims are set before the first sign-in (09 §6)
const USERS: Record<string, [string | null, string | null, boolean]> = {
  adminA: ['A', 'admin', true], operatorA: ['A', 'operator', true], inactiveA: ['A', 'operator', false],
  adminB: ['B', 'admin', true], operatorB: ['B', 'operator', true],
  adminC: ['C', 'admin', true], superadmin: [null, 'superadmin', true], stray: [null, null, true],
};
const BUSINESSES: Record<string, [string, string]> = { A: ['Negocio A', 'active'], B: [SENTINEL, 'active'], C: ['Negocio C', 'blocked'] };

export async function clearAll() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function token(email: string) {
  const r = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return ((await r.json()) as { idToken: string }).idToken;
}

export async function start() {
  await clearAll();
  const ids: Record<string, string> = {};
  for (const [k, [name, status]] of Object.entries(BUSINESSES)) {
    const ref = db.collection('businesses').doc();
    ids[k] = ref.id;
    await ref.set({ name, status, enabledVehicleTypes: ['moto'] });
  }
  const tokens: Record<string, string> = {};
  for (const [k, [b, role, active]] of Object.entries(USERS)) {
    const email = `${k}@test.local`;
    const { uid } = await auth.createUser({ email, password: PASSWORD });
    if (role) await auth.setCustomUserClaims(uid, b ? { role, businessId: ids[b] } : { role });
    if (b) await db.doc(`businesses/${ids[b]}/members/${uid}`).set({ name: k, role, active });
    tokens[k] = await token(email);
  }
  const app = await createApp();
  await app.listen(0);
  const url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const call = (path: string, tok?: string, body: unknown = {}) =>
    fetch(`${url}/api/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify(body),
    });
  return { url, ids, tokens, call, close: () => app.close() };
}

// Every document under a path, recursively, as one comparable object.
export async function dump(ref: FirebaseFirestore.DocumentReference): Promise<unknown> {
  const out: Record<string, unknown> = { _: (await ref.get()).data() };
  for (const c of await ref.listCollections()) {
    for (const d of (await c.get()).docs) out[`${c.id}/${d.id}`] = await dump(d.ref);
  }
  return out;
}
