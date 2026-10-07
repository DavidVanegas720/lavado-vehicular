<script setup lang="ts">
withDefaults(
  defineProps<{
    variante: "texto" | "tarjeta" | "tabla" | "circulo";
    lineas?: number;
    filas?: number;
  }>(),
  { lineas: 3, filas: 5 },
);
const barra = "rounded-control bg-borde/60 animate-pulse motion-reduce:animate-none";
</script>

<template>
  <div role="status" aria-busy="true" aria-live="polite" data-testid="skeleton">
    <span class="sr-only">Cargando…</span>
    <div v-if="variante === 'texto'" class="flex flex-col gap-2" aria-hidden="true">
      <div
        v-for="n in lineas"
        :key="n"
        :class="[barra, 'h-4']"
        :style="{ width: n === lineas && lineas > 1 ? '60%' : '100%' }"
      />
    </div>
    <div
      v-else-if="variante === 'tarjeta'"
      class="flex flex-col gap-3 rounded-tarjeta border border-borde p-4"
      aria-hidden="true"
    >
      <div :class="[barra, 'h-5 w-1/2']" />
      <div :class="[barra, 'h-4 w-full']" />
      <div :class="[barra, 'h-4 w-3/4']" />
    </div>
    <div v-else-if="variante === 'tabla'" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="n in filas" :key="n" :class="[barra, 'h-10 w-full']" />
    </div>
    <div v-else :class="[barra, 'size-12 rounded-full']" aria-hidden="true" />
  </div>
</template>
