// API driver for the shared contract cases (tests/contracts/cases): the mock's keys, the mock's clock, and the wire
// functions of src/api/endpoints.js. Runs on the emulator only (endpoints.test.ts).
import { coded } from '../errors.js';
import { start, token } from './harness.js';

const DAY1 = new Date('2026-10-29T15:00:00Z'); // the mock driver's reset clock
const KEYS: Record<string, string> = {
  operator: 'operatorA', operator2: 'operator2A', admin: 'adminA', otherAdmin: 'adminB', superadmin: 'superadmin',
  otherOperator: 'operatorB', blockedOperator: 'operatorC',
};

export async function apiDriver() {
  const { makeApi } = (await import('../../../src/api/endpoints.js' as string)) as {
    makeApi: (call: (path: string, body?: unknown) => Promise<any>) => Record<string, (...a: any[]) => Promise<any>>;
  };
  let s: Awaited<ReturnType<typeof start>> | undefined;
  let who = '';
  let now = DAY1;
  let own: string | undefined; // token of a user signed in by signInWith; `as` clears it
  const send = async (path: string, body: unknown = {}) => {
    const r = await s!.call(path, own ?? s!.tokens[KEYS[who]], body, now);
    const json = await r.json();
    if (!r.ok) throw coded((json as { code: string }).code);
    return json;
  };
  return {
    reset: async () => { await s?.close(); s = await start(); now = DAY1; own = undefined; },
    as: async (k: string) => { who = k; own = undefined; },
    // real Auth sign-in; the session then acts as that user. A disabled account is forbidden, any other failure unauthenticated.
    signInWith: async (email: string, password: string) => {
      try { own = await token(email, password); } catch (e) {
        throw coded((e as Error).message.includes('USER_DISABLED') ? 'forbidden' : 'unauthenticated');
      }
      return send('session/get');
    },
    at: (d: Date) => { now = d; },
    businessIdOf: (k: string) => s!.ids[k],
    idOf: (k: string) => s!.uids[KEYS[k]],
    close: async () => { await s?.close(); },
    sessionGet: () => send('session/get'),
    ...makeApi(send),
  };
}
