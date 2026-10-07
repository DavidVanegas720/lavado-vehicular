<script setup lang="ts">
import type { Trabajador } from "@lavado-vehicular/shared/esquemas/trabajadores";
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
    trabajadores: readonly Trabajador[];
    incluirInactivos?: boolean;
    permiteSinAsignar?: boolean;
  }>(),
  {
    id: undefined,
    ayuda: undefined,
    error: null,
    requerido: false,
    deshabilitado: false,
    incluirInactivos: false,
    permiteSinAsignar: false,
  },
);

const emit = defineEmits<{ "update:modelValue": [valor: string | null]; blur: [] }>();

// Valor interno de la opción "Sin asignar"; hacia afuera se emite `null`.
const SIN_ASIGNAR = "__sin_asignar__";

// P-G: se asume que "Sin asignar" solo se ofrece si el llamador lo pide (la orden exige trabajador, H-01).
const opciones = computed<OpcionSelector[]>(() => {
  const lista: OpcionSelector[] = props.trabajadores
    .filter((t) => props.incluirInactivos || t.activo || t.id === props.modelValue)
    .map((t) => ({ valor: t.id, etiqueta: t.activo ? t.nombre : `${t.nombre} (inactivo)` }));
  return props.permiteSinAsignar
    ? [{ valor: SIN_ASIGNAR, etiqueta: "Sin asignar" }, ...lista]
    : lista;
});

const valorInterno = computed(() =>
  props.modelValue === null && props.permiteSinAsignar ? SIN_ASIGNAR : props.modelValue,
);

function alCambiar(v: string | null): void {
  emit("update:modelValue", v === SIN_ASIGNAR ? null : v);
}
</script>

<template>
  <SelectorBase
    :id="id"
    :etiqueta="etiqueta"
    :ayuda="ayuda"
    :error="error"
    :requerido="requerido"
    :deshabilitado="deshabilitado"
    :model-value="valorInterno"
    :opciones="opciones"
    placeholder="Seleccionar trabajador…"
    @update:model-value="alCambiar"
    @blur="emit('blur')"
  />
</template>
