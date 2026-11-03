<script setup>
import { useRouter } from 'vue-router'
import { listDemoUsers } from '../services/session.js'
import { useSessionStore } from '../stores/session.js'
import { homeOf } from '../router/nav.js'

const store = useSessionStore()
const router = useRouter()
const users = listDemoUsers()
const ROLE_LABEL = { operator: 'Operador', admin: 'Administrador', superadmin: 'Superadmin' }

function enter(id) {
  store.signIn(id)
  router.push(homeOf(store.user.role))
}
</script>

<template>
  <main class="mx-auto max-w-md p-4">
    <h1 class="mb-4 text-2xl font-bold">Lavadero</h1>
    <p class="mb-4">Entrá como:</p>
    <ul class="space-y-2">
      <li v-for="u in users" :key="u.uid">
        <button
          type="button"
          class="min-h-11 w-full rounded border border-slate-400 px-4 py-2 text-left hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          @click="enter(u.uid)"
        >
          {{ u.name }} — {{ ROLE_LABEL[u.role] }}<span v-if="u.businessName">, {{ u.businessName }}</span>
        </button>
      </li>
    </ul>
  </main>
</template>
