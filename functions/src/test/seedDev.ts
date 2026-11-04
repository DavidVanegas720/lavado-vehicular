// Dev data for the running emulator (npm run seed:dev). Clears the emulator first, so it refuses to run without the
// emulator env vars. Adds one done cash order in yesterday's shift instance, so a close can be tried today.
import { buildOrder, finishFields } from '../domain/order.js';
import { shiftOf } from '../domain/shift.js';
import { db } from '../firebase.js';
import { clearAll, emulators, mockSeed, seed } from './harness.js';

const DEV_PASSWORD = 'lavado-dev-1';
const HOUR = 3600000;

async function main() {
  if (!emulators) throw new Error('seed:dev needs FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST');
  await clearAll();
  const { ids, uids } = await seed(DEV_PASSWORD);
  const biz = db.doc(`businesses/${ids.A}`);
  const { shifts } = (await biz.get()).data()!;
  const prev = shiftOf(new Date(Date.now() - 24 * HOUR), shifts); // the instance that has ended (its length is 24 h)
  const openAt = new Date(prev.endsAt.getTime() - 23 * HOUR); // inside that instance
  const operator = { uid: uids.operatorA, role: 'operator' as const };
  await biz.collection('shiftEvents').doc(`${prev.shiftKey}_open`).set({
    type: 'open', shiftKey: prev.shiftKey, shiftName: prev.shiftName, endsAt: prev.endsAt,
    openingCash: 50000, at: openAt, by: operator.uid, seq: 0,
  });
  const catalog = (await mockSeed()).catalogs.medallo;
  const orderAt = new Date(openAt.getTime() + HOUR);
  const order = buildOrder(
    { plate: 'ABC12D', vehicleType: 'motorcycle', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' },
    catalog, operator, orderAt, shifts,
  );
  const done = { ...order, ...finishFields(order, { paymentMethod: 'cash' }, operator, new Date(orderAt.getTime() + HOUR / 2)) };
  await biz.collection('orders').doc('seed-order').set(done);
  console.log(`dev password: ${DEV_PASSWORD}`);
  for (const k of Object.keys(uids).filter((k) => k.startsWith('operator'))) console.log(`${k}@test.local`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
