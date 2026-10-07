<script setup lang="ts">
import { useSlots } from "vue";

const props = defineProps<{
  titulo?: string;
  subtitulo?: string;
  interactiva?: boolean;
  etiquetaAccesible?: string;
}>();
const emit = defineEmits<{ seleccionar: [] }>();
const slots = useSlots();

function seleccionar(): void {
  if (props.interactiva) emit("seleccionar");
}
</script>

<template>
  <article
    :tabindex="interactiva ? 0 : undefined"
    :role="interactiva ? 'button' : undefined"
    :aria-label="etiquetaAccesible"
    :class="[
      'flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 text-texto shadow-suave',
      interactiva
        ? 'cursor-pointer transition duration-150 ease-out hover:shadow-elevada focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario motion-reduce:transition-none'
        : '',
    ]"
    @click="seleccionar"
    @keydown.enter.prevent="seleccionar"
    @keydown.space.prevent="seleccionar"
  >
    <header
      v-if="titulo || subtitulo || slots.encabezado || slots.acciones"
      class="flex items-start justify-between gap-3"
    >
      <div class="min-w-0">
        <slot name="encabezado">
          <h3 v-if="titulo" class="text-grande font-semibold">{{ titulo }}</h3>
          <p v-if="subtitulo" class="text-pequeno text-texto-suave">{{ subtitulo }}</p>
        </slot>
      </div>
      <div v-if="slots.acciones" class="shrink-0"><slot name="acciones" /></div>
    </header>
    <div><slot /></div>
    <footer v-if="slots.pie" class="border-t border-borde pt-3"><slot name="pie" /></footer>
  </article>
</template>
