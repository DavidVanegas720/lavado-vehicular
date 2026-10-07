<script setup lang="ts">
// Interno: compartido por BotonPrincipal / BotonSecundario / BotonPeligro. No es API pública.
import { computed } from "vue";

export type VarianteBoton = "principal" | "secundario" | "peligro";

const props = withDefaults(
  defineProps<{
    variante: VarianteBoton;
    etiqueta: string;
    icono?: string;
    soloIcono?: boolean;
    ariaLabel?: string;
    cargando?: boolean;
    deshabilitado?: boolean;
    tipo?: "button" | "submit";
    bloque?: boolean;
  }>(),
  { tipo: "button" },
);

const emit = defineEmits<{ click: [evento: MouseEvent] }>();

const clasesVariante: Record<VarianteBoton, string> = {
  principal: "bg-primario text-primario-contraste hover:brightness-110 focus-visible:ring-primario",
  secundario:
    "bg-superficie text-texto border border-borde hover:bg-fondo focus-visible:ring-primario",
  peligro: "bg-peligro text-primario-contraste hover:brightness-110 focus-visible:ring-peligro",
};

const etiquetaAccesible = computed(() =>
  props.soloIcono ? (props.ariaLabel ?? props.etiqueta) : props.ariaLabel,
);

function alClic(evento: MouseEvent): void {
  if (props.cargando || props.deshabilitado) return;
  emit("click", evento);
}
</script>

<template>
  <button
    :type="tipo"
    :disabled="deshabilitado"
    :aria-disabled="cargando ? 'true' : undefined"
    :aria-busy="cargando ? 'true' : undefined"
    :aria-label="etiquetaAccesible"
    :class="[
      'relative inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 font-medium',
      'transition duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-fondo',
      'disabled:cursor-not-allowed disabled:opacity-50',
      soloIcono ? 'min-w-11 px-0' : '',
      bloque ? 'w-full' : '',
      cargando ? 'cursor-progress' : '',
      clasesVariante[variante],
    ]"
    @click="alClic"
  >
    <span :class="['inline-flex items-center gap-2', cargando ? 'opacity-0' : '']">
      <i v-if="icono" :class="['pi', icono]" aria-hidden="true" />
      <span v-if="!soloIcono">{{ etiqueta }}</span>
    </span>
    <i
      v-if="cargando"
      class="pi pi-spin pi-spinner absolute motion-reduce:animate-none"
      aria-hidden="true"
    />
  </button>
</template>
