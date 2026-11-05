import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { makeApi } from './endpoints.js'
import { coded } from '../mocks/errors.js'

// The only place that reads the mode flag and the only place that fetches.
export const MOCK = import.meta.env.VITE_MOCK === '1'

// Dev: emulator config. Build: public web config from VITE_FIREBASE_* (.env.prod, see .env.example).
const config = import.meta.env.DEV
  ? { projectId: 'demo-lavadero', apiKey: 'demo-key' }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }
if (!config.apiKey && !MOCK) throw new Error('Missing VITE_FIREBASE_* config')
export const auth = getAuth(initializeApp(config))
if (import.meta.env.DEV) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/
const reviver = (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v)

// No automatic retry: a silent retry is what doubles money.
export async function call(path, body) {
  const user = auth.currentUser
  if (!user) throw coded('unauthenticated')
  let res, data
  try {
    const token = await user.getIdToken()
    res = await fetch('/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    })
    data = JSON.parse(await res.text(), reviver)
  } catch {
    throw coded('internal')
  }
  if (!res.ok) throw coded(typeof data?.code === 'string' ? data.code : 'internal')
  return data
}

export const api = makeApi(call)
