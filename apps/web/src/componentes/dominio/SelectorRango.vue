<script setup lang="ts">
import type { RangoCilindraje } from "@lavado-vehicular/shared/esquemas/catalogo";
import { computed } from "vue";
import SelectorBase, { type OpcionSelector } from "../base/SelectorBase.vue";

const props = withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    modelValue: string | null;
    rangos: readonly RangoCilindraje[];
  }>(),
  { id: undefined, ayuda: undefined, error: null, requerido: false, deshabilitado: false },
);

const emit = defineEmits<{ "update:modelValue": [valor: string | null]; blur: [] }>();

function descripcion(r: RangoCilindraje): string {
  return r.cc_max === null
    ? `Desde ${String(r.cc_min)} cc`
    : `${String(r.cc_min)} a ${String(r.cc_max)} cc`;
}

// Solo rangos activos (el elegido se conserva), ordenados por `orden_visualizacion`.
const opciones = computed<OpcionSelector[]>(() =>
  props.rangos
    .filter((r) => r.activo || r.id === props.modelValue)
    .toSorted((a, b) => a.orden_visualizacion - b.orden_visualizacion)
    .map((r) => ({ valor: r.id, etiqueta: r.nombre, descripcion: descripcion(r) })),
);
</script>

<template>
  <SelectorBase
    :id="id"
    :etiqueta="etiqueta"
    :ayuda="ayuda"
    :error="error"
    :requerido="requerido"
    :deshabilitado="deshabilitado"
    :model-value="modelValue"
    :opciones="opciones"
    placeholder="Seleccionar cilindraje…"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @blur="emit('blur')"
  />
</template>
