<script setup lang="ts">
import type { Servicio, TipoServicio } from "@lavado-vehicular/shared/esquemas/catalogo";
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
    servicios: readonly Servicio[];
    tipo?: TipoServicio;
    incluirInactivos?: boolean;
  }>(),
  {
    id: undefined,
    ayuda: undefined,
    error: null,
    requerido: false,
    deshabilitado: false,
    tipo: undefined,
    incluirInactivos: false,
  },
);

const emit = defineEmits<{ "update:modelValue": [valor: string | null]; blur: [] }>();

// Un servicio inactivo ya elegido se conserva visible para no dejar el campo en blanco.
const opciones = computed<OpcionSelector[]>(() =>
  props.servicios
    .filter((s) => props.tipo === undefined || s.tipo === props.tipo)
    .filter((s) => props.incluirInactivos || s.activo || s.id === props.modelValue)
    .map((s) => ({
      valor: s.id,
      etiqueta: s.activo ? s.nombre : `${s.nombre} (inactivo)`,
      ...(s.descripcion ? { descripcion: s.descripcion } : {}),
    })),
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
    placeholder="Seleccionar servicio…"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @blur="emit('blur')"
  />
</template>
