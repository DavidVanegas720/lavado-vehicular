<script setup lang="ts">
import { useSlots } from "vue";

defineProps<{ titulo: string; subtitulo?: string }>();
const slots = useSlots();
</script>

<template>
  <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0">
      <h1 tabindex="-1" class="text-titulo font-semibold text-texto focus:outline-none">
        {{ titulo }}
      </h1>
      <p v-if="subtitulo" class="text-texto-suave">{{ subtitulo }}</p>
    </div>
    <div v-if="slots.acciones" class="flex flex-wrap items-center gap-2">
      <slot name="acciones" />
    </div>
  </header>
</template>
