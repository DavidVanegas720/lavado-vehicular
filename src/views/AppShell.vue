<script setup>
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session.js'
import { NAV } from '../router/nav.js'

const store = useSessionStore()
const router = useRouter()

// Sign out first: the guard would send a signed-in user away from /sign-in.
async function leave() {
  await store.signOut()
  router.push('/sign-in')
}
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:bg-white focus:p-2 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
  >Saltar al contenido</a>
  <header class="border-b border-slate-300 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="font-bold">{{ store.user?.businessName ?? 'Lavadero' }}</p>
      <p class="flex items-center gap-3">
        <span>{{ store.user?.name }}</span>
        <button
          type="button"
          class="min-h-11 rounded border border-slate-400 px-4 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          @click="leave"
        >Salir</button>
      </p>
    </div>
    <nav aria-label="Principal" class="mt-2">
      <ul class="flex flex-wrap gap-2">
        <li v-for="e in (NAV[store.user?.role] ?? [])" :key="e.path">
          <RouterLink
            :to="e.path"
            class="inline-flex min-h-11 items-center rounded px-3 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
            active-class="bg-slate-200 font-bold"
          >{{ e.label }}</RouterLink>
        </li>
      </ul>
    </nav>
  </header>
  <main id="main" class="mx-auto max-w-2xl p-4"><RouterView /></main>
</template>
