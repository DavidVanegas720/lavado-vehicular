// API driver for the shared contract cases (tests/contracts/cases): the mock's keys, the mock's clock, and the wire
// functions of src/api/endpoints.js. Runs on the emulator only (endpoints.test.ts).
import { coded } from '../errors.js';
import { start } from './harness.js';

const DAY1 = new Date('2026-10-29T15:00:00Z'); // the mock driver's reset clock
const KEYS: Record<string, string> = {
  operator: 'operatorA', operator2: 'operator2A', admin: 'adminA', superadmin: 'superadmin',
  otherOperator: 'operatorB', blockedOperator: 'operatorC',
};

export async function apiDriver() {
  const { makeApi } = (await import('../../../src/api/endpoints.js' as string)) as {
    makeApi: (call: (path: string, body?: unknown) => Promise<any>) => Record<string, (...a: any[]) => Promise<any>>;
  };
  let s: Awaited<ReturnType<typeof start>> | undefined;
  let who = '';
  let now = DAY1;
  const send = async (path: string, body: unknown = {}) => {
    const r = await s!.call(path, s!.tokens[KEYS[who]], body, now);
    const json = await r.json();
    if (!r.ok) throw coded((json as { code: string }).code);
    return json;
  };
  return {
    reset: async () => { await s?.close(); s = await start(); now = DAY1; },
    as: async (k: string) => { who = k; },
    at: (d: Date) => { now = d; },
    close: async () => { await s?.close(); },
    sessionGet: () => send('session/get'),
    ...makeApi(send),
  };
}
