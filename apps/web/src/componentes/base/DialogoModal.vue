<script setup lang="ts">
import Dialog from "primevue/dialog";
import { computed, nextTick, watch } from "vue";

const props = withDefaults(
  defineProps<{
    titulo: string;
    descripcion?: string;
    ancho?: "sm" | "md" | "lg";
    cerrable?: boolean;
    pantallaCompletaEnMovil?: boolean;
  }>(),
  { ancho: "md", cerrable: true, pantallaCompletaEnMovil: true },
);
const visible = defineModel<boolean>("visible", { required: true });
const emit = defineEmits<{ cerrar: [] }>();

const anchos = { sm: "24rem", md: "32rem", lg: "48rem" } as const;
const idDescripcion = `dialogo-desc-${Math.random().toString(36).slice(2, 9)}`;
const breakpoints = computed(() =>
  props.pantallaCompletaEnMovil ? { "767px": "100vw" } : undefined,
);

// Devuelve el foco al disparador al cerrar.
let disparador: HTMLElement | null = null;
watch(visible, (abierto, antes) => {
  if (abierto && !antes) {
    disparador = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  } else if (!abierto && antes) {
    const el = disparador;
    disparador = null;
    void nextTick(() => el?.focus());
    emit("cerrar");
  }
});
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="titulo"
    :closable="cerrable"
    :close-on-escape="cerrable"
    :dismissable-mask="false"
    :draggable="false"
    :style="{ width: anchos[ancho] }"
    :breakpoints="breakpoints"
    :aria-describedby="descripcion ? idDescripcion : undefined"
    :pt="{ pcCloseButton: { root: { 'aria-label': 'Cerrar' } } }"
  >
    <p v-if="descripcion" :id="idDescripcion" class="mb-4 text-texto-suave">{{ descripcion }}</p>
    <slot />
    <template v-if="$slots.pie" #footer><slot name="pie" /></template>
  </Dialog>
</template>
