<script setup lang="ts">
function saltar(evento: Event): void {
  evento.preventDefault();
  document.getElementById("contenido")?.focus();
}
</script>

<template>
  <a
    href="#contenido"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast"
    @click="saltar"
  >
    Saltar al contenido
  </a>
</template>
