<script setup lang="ts">
import type { EstadoOrden } from "@lavado-vehicular/shared/esquemas/ordenes";
import { computed } from "vue";

const props = withDefaults(defineProps<{ estado: EstadoOrden; tamano?: "sm" | "md" }>(), {
  tamano: "md",
});

const config: Record<EstadoOrden, { etiqueta: string; icono: string; clases: string }> = {
  CREADA: {
    etiqueta: "Creada",
    icono: "pi-plus-circle",
    clases: "bg-estado-creada-fondo text-estado-creada",
  },
  LAVANDO: {
    etiqueta: "Lavando",
    icono: "pi-spinner",
    clases: "bg-estado-lavando-fondo text-estado-lavando",
  },
  LISTA: {
    etiqueta: "Lista",
    icono: "pi-check-circle",
    clases: "bg-estado-lista-fondo text-estado-lista",
  },
  COBRADA: {
    etiqueta: "Cobrada",
    icono: "pi-wallet",
    clases: "bg-estado-cobrada-fondo text-estado-cobrada",
  },
  ENTREGADA: {
    etiqueta: "Entregada",
    icono: "pi-send",
    clases: "bg-estado-entregada-fondo text-estado-entregada",
  },
  ANULADA: {
    etiqueta: "Anulada",
    icono: "pi-ban",
    clases: "bg-estado-anulada-fondo text-estado-anulada line-through",
  },
};
const actual = computed(() => config[props.estado]);
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      tamano === 'sm' ? 'px-2 py-0.5 text-pequeno' : 'px-3 py-1 text-base',
      actual.clases,
    ]"
  >
    <i :class="['pi', actual.icono]" aria-hidden="true" />
    <span>{{ actual.etiqueta }}</span>
  </span>
</template>
