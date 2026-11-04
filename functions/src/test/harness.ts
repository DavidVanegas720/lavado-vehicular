import type { AddressInfo } from 'node:net';
import { createApp } from '../index.js';
import { auth, db } from '../firebase.js';

export const PROJECT = 'demo-lavadero';
export const SENTINEL = 'NEGOCIO-B-SENTINEL';
export const emulators = !!(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const PASSWORD = 'test-password-1';

// key -> [business, role, active]; claims are set before the first sign-in (09 §6)
const USERS: Record<string, [string | null, string | null, boolean]> = {
  adminA: ['A', 'admin', true], operatorA: ['A', 'operator', true], operator2A: ['A', 'operator', true], inactiveA: ['A', 'operator', false],
  adminB: ['B', 'admin', true], operatorB: ['B', 'operator', true],
  adminC: ['C', 'admin', true], operatorC: ['C', 'operator', true], superadmin: [null, 'superadmin', true], stray: [null, null, true],
};
const BUSINESSES: Record<string, [string, string]> = { A: ['Negocio A', 'active'], B: [SENTINEL, 'active'], C: ['Negocio C', 'blocked'] };

export async function clearAll() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function token(email: string, password: string) {
  const r = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return ((await r.json()) as { idToken: string }).idToken;
}

// The mock seed (src/mocks/seed.js), loaded at runtime so tsc does not compile the .js file.
export async function mockSeed(): Promise<any> {
  return (await import('../../../src/mocks/seed.js' as string)).createSeed();
}

// Writes businesses, users and business A's catalog (C16). Caller clears first. Returns ids and uids by key.
export async function seed(password: string) {
  const ids: Record<string, string> = {};
  for (const [k, [name, status]] of Object.entries(BUSINESSES)) {
    const ref = db.collection('businesses').doc();
    ids[k] = ref.id;
    await ref.set({ name, status, enabledVehicleTypes: ['motorcycle'], shifts: [{ id: 'unico', name: 'Turno único', startHour: 6, endHour: 6 }] }); // one 24 h shift: opens at any real time
  }
  const cat = (await mockSeed()).catalogs.medallo;
  const biz = db.doc(`businesses/${ids.A}`);
  const batch = db.batch();
  for (const c of cat.categories) batch.set(biz.collection('categories').doc(c.id), c);
  for (const w of cat.washTypes) batch.set(biz.collection('washTypes').doc(w.id), w);
  for (const { commissionHistory, payFrequencyHistory, ...w } of cat.washers) batch.set(biz.collection('washers').doc(w.id), w);
  for (const p of cat.prices) batch.set(biz.collection('prices').doc(`${p.categoryId}_${p.washTypeId}`), p);
  await batch.commit();
  const uids: Record<string, string> = {};
  for (const [k, [b, role, active]] of Object.entries(USERS)) {
    const { uid } = await auth.createUser({ email: `${k}@test.local`, password });
    uids[k] = uid;
    if (role) await auth.setCustomUserClaims(uid, b ? { role, businessId: ids[b] } : { role });
    if (b) await db.doc(`businesses/${ids[b]}/members/${uid}`).set({ name: k, role, active });
  }
  return { ids, uids };
}

export async function start() {
  await clearAll();
  const { ids, uids } = await seed(PASSWORD);
  const tokens: Record<string, string> = {};
  for (const k of Object.keys(uids)) tokens[k] = await token(`${k}@test.local`, PASSWORD);
  const app = await createApp();
  await app.listen(0);
  const url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  // now: sent as x-test-now; the server honors it only on the emulator
  const call = (path: string, tok?: string, body: unknown = {}, now?: Date) =>
    fetch(`${url}/api/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(tok ? { authorization: `Bearer ${tok}` } : {}),
        ...(now ? { 'x-test-now': now.toISOString() } : {}),
      },
      body: JSON.stringify(body),
    });
  return { url, ids, uids, tokens, call, close: () => app.close() };
}

// Every document under a path, recursively, as one comparable object.
export async function dump(ref: FirebaseFirestore.DocumentReference): Promise<unknown> {
  const out: Record<string, unknown> = { _: (await ref.get()).data() };
  for (const c of await ref.listCollections()) {
    for (const d of (await c.get()).docs) out[`${c.id}/${d.id}`] = await dump(d.ref);
  }
  return out;
}
