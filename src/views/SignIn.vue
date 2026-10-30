<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { listDemoUsers } from '../services/session.js';
import { ROLE_LABELS } from '../domain/roles.js';
import { useSessionStore } from '../stores/session.js';

const router = useRouter();
const session = useSessionStore();
const demoUsers = listDemoUsers();
const error = ref('');

async function enter(userId) {
  error.value = '';
  try {
    await session.signIn(userId);
    await router.push('/');
  } catch {
    error.value = 'No se pudo ingresar. Intentá de nuevo.';
  }
}
</script>

<template>
  <main class="grid min-h-dvh place-items-center p-4">
    <section class="w-full max-w-sm space-y-4">
      <h1 class="text-2xl font-semibold">Ingresar</h1>
      <p class="text-sm text-slate-600">Modo demostración: elegí un usuario.</p>
      <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
      <ul class="space-y-2">
        <li v-for="user in demoUsers" :key="user.id">
          <button
            type="button"
            class="w-full rounded-lg border border-slate-300 px-4 py-3 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            @click="enter(user.id)"
          >
            <span class="block font-medium">{{ user.name }}</span>
            <span class="block text-sm text-slate-600">{{ ROLE_LABELS[user.role] }}</span>
          </button>
        </li>
      </ul>
    </section>
  </main>
</template>
