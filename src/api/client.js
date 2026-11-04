import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { makeApi } from './endpoints.js'
import { coded } from '../mocks/errors.js'

// The only place that reads the mode flag and the only place that fetches.
export const MOCK = import.meta.env?.VITE_MOCK === '1'

// shortcut: production web config is added at P12 (public values)
export const auth = getAuth(initializeApp({ projectId: 'demo-lavadero', apiKey: 'demo-key' }))
if (import.meta.env?.DEV) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

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
