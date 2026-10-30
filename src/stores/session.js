import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as sessionService from '../services/session.js';

export const useSessionStore = defineStore('session', () => {
  const user = ref(null);
  const active = computed(() => user.value !== null);
  const role = computed(() => user.value?.role ?? null);

  async function signIn(userId) {
    user.value = await sessionService.signIn(userId);
  }

  async function signOut() {
    await sessionService.signOut();
    user.value = null;
  }

  return { user, active, role, signIn, signOut };
});
