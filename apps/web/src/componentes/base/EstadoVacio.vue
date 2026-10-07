<script setup lang="ts">
import { useSlots } from "vue";

withDefaults(
  defineProps<{
    titulo: string;
    descripcion?: string;
    icono?: string;
    tono?: "neutro" | "error";
  }>(),
  { tono: "neutro" },
);
const slots = useSlots();
</script>

<template>
  <div
    :role="tono === 'error' ? 'alert' : undefined"
    class="flex flex-col items-center gap-3 px-4 py-10 text-center"
  >
    <i
      v-if="icono"
      :class="['pi', icono, 'text-4xl', tono === 'error' ? 'text-peligro' : 'text-texto-suave']"
      aria-hidden="true"
    />
    <h2 class="text-grande font-semibold text-texto">{{ titulo }}</h2>
    <p v-if="descripcion" class="max-w-prose text-texto-suave">{{ descripcion }}</p>
    <div v-if="slots.accion" class="mt-2"><slot name="accion" /></div>
  </div>
</template>
