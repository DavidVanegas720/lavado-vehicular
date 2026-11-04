import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as session from '../services/session.js'

export const useSessionStore = defineStore('session', () => {
  const user = ref(null)
  // Guards await this once so the first navigation sees the restored session.
  const ready = session.getSession().then((u) => { user.value = u })
  const signIn = async (...args) => { user.value = await session.signIn(...args) }
  const signOut = async () => { await session.signOut(); user.value = null }
  return { user, ready, signIn, signOut }
})
