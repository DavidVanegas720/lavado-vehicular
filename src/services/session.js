import { signInWithEmailAndPassword } from 'firebase/auth'
import { MOCK, api, auth } from '../api/client.js'
import * as mock from '../mocks/session.js'

export const listDemoUsers = mock.listDemoUsers

export const signIn = MOCK
  ? mock.signIn
  : async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password)
      return api.getSession()
    }

export const getSession = MOCK
  ? mock.getSession
  : async () => {
      await auth.authStateReady()
      return auth.currentUser ? api.getSession() : null
    }

export const signOut = MOCK ? mock.signOut : () => auth.signOut()
