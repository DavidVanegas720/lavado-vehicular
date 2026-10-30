<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-xl font-semibold">{{ route.meta.title }}</h1>
    <p class="text-slate-600">Pantalla en construcción.</p>
  </section>
</template>
