import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as session from '../services/session.js'

export const useSessionStore = defineStore('session', () => {
  const user = ref(session.getSession())
  const signIn = (userId) => { user.value = session.signIn(userId) }
  const signOut = () => { session.signOut(); user.value = null }
  return { user, signIn, signOut }
})
