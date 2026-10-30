<script setup>
import { computed } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { NAV } from '../router/nav.js';
import { ROLE_LABELS } from '../domain/roles.js';
import { useSessionStore } from '../stores/session.js';

const router = useRouter();
const session = useSessionStore();
const items = computed(() => NAV.filter((item) => item.roles.includes(session.role)));
const heading = computed(() => session.user?.business?.name ?? 'Plataforma');

async function leave() {
  await session.signOut();
  await router.push('/sign-in');
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="border-b border-slate-200 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="font-semibold">{{ heading }}</p>
          <p class="text-sm text-slate-600">{{ session.user?.name }} · {{ ROLE_LABELS[session.role] }}</p>
        </div>
        <button
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="leave"
        >
          Salir
        </button>
      </div>
    </header>

    <nav aria-label="Principal" class="border-b border-slate-200 px-4 py-2">
      <ul class="flex flex-wrap gap-2">
        <li v-for="item in items" :key="item.path">
          <RouterLink
            :to="item.path"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            active-class="bg-slate-900 text-white hover:bg-slate-900"
          >
            <component :is="item.icon" :size="18" aria-hidden="true" />
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <main class="p-4">
      <RouterView />
    </main>
  </div>
</template>
