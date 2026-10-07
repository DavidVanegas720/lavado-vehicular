<!-- eslint-disable vue/multi-word-component-names -- nombre fijado por el plan F1-1 -->
<script setup lang="ts">
// Montar una sola vez (App.vue). Móvil: arriba-centro; desde 768 px: arriba-derecha.
import Toast from "primevue/toast";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const CONSULTA = "(min-width: 768px)";
const esEscritorio = ref(false);
const posicion = computed(() => (esEscritorio.value ? "top-right" : "top-center"));
let lista: MediaQueryList | null = null;
const alCambiar = (e: MediaQueryListEvent): void => {
  esEscritorio.value = e.matches;
};

onMounted(() => {
  if (typeof window.matchMedia !== "function") return; // entornos sin matchMedia: se queda en móvil
  lista = window.matchMedia(CONSULTA);
  esEscritorio.value = lista.matches;
  lista.addEventListener("change", alCambiar);
});
onBeforeUnmount(() => lista?.removeEventListener("change", alCambiar));
</script>

<template>
  <Toast :position="posicion" :close-button-props="{ 'aria-label': 'Cerrar notificación' }" />
</template>
