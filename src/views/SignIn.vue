<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listDemoUsers } from '../services/session.js'
import { useSessionStore } from '../stores/session.js'
import { homeOf } from '../router/nav.js'
import { MOCK } from '../api/client.js'

const store = useSessionStore()
const router = useRouter()
const users = ref([])
onMounted(async () => { if (MOCK) users.value = await listDemoUsers() })
const ROLE_LABEL = { operator: 'Operador', admin: 'Administrador', superadmin: 'Superadmin' }

const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const MESSAGES = {
  // wrong-password and user-not-found come back when the project's email enumeration protection is off
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/user-disabled': 'Tu usuario está desactivado. Habla con el administrador.',
  forbidden: 'Tu usuario está desactivado. Habla con el administrador.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
}

async function enter(...args) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await store.signIn(...args)
    router.push(homeOf(store.user.role))
  } catch (e) {
    error.value = MESSAGES[e.code] ?? 'No se pudo entrar. Intentá de nuevo.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="mx-auto max-w-md p-4">
    <h1 class="mb-4 text-2xl font-bold">Lavadero</h1>
    <template v-if="MOCK">
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
    </template>
    <form v-else class="space-y-4" @submit.prevent="enter(email, password)">
      <div>
        <label for="email" class="mb-1 block">Correo</label>
        <input
          id="email" v-model="email" type="email" autocomplete="username" required
          class="min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
        />
      </div>
      <div>
        <label for="password" class="mb-1 block">Contraseña</label>
        <input
          id="password" v-model="password" type="password" autocomplete="current-password" required
          class="min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
        />
      </div>
      <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
      <button
        type="submit" :disabled="busy"
        class="min-h-11 w-full rounded bg-blue-700 px-4 py-2 text-white focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60"
      >
        {{ busy ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </main>
</template>
