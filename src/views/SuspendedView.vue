<script setup>
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session.js'

const store = useSessionStore()
const router = useRouter()

function leave() {
  store.signOut()
  router.push('/sign-in')
}
</script>

<template>
  <main class="mx-auto max-w-md p-4">
    <h1 class="mb-4 text-2xl font-bold">Cuenta suspendida. Contactá a soporte.</h1>
    <button
      type="button"
      class="min-h-11 rounded border border-slate-400 px-4 py-2 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
      @click="leave"
    >
      Salir
    </button>
  </main>
</template>
