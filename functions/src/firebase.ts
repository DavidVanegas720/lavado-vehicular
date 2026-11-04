import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (process.env.FIRESTORE_EMULATOR_HOST && process.env.GCLOUD_PROJECT !== 'demo-lavadero') {
  throw new Error('Emulator host set but project is not demo-lavadero: refusing to start');
}

const app = initializeApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

// The only place a tenant path starts; businessId comes from the verified token only.
export const tenant = (ctx: { businessId: string }) => db.doc('businesses/' + ctx.businessId);

// Every read of stored data goes through this: Timestamp -> Date, recursively (C13).
export const plain = (v: unknown): any =>
  v instanceof Timestamp ? v.toDate()
  : Array.isArray(v) ? v.map(plain)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
  : v;
