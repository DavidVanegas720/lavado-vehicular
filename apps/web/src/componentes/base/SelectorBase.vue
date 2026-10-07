<script setup lang="ts">
import Select from "primevue/select";
import { computed } from "vue";
import CampoBase from "./CampoBase.vue";

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
  descripcion?: string;
  deshabilitada?: boolean;
}

const props = withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    opciones: readonly OpcionSelector[];
    modelValue: string | null;
    placeholder?: string;
    filtrable?: boolean;
    cargando?: boolean;
  }>(),
  {
    id: undefined,
    ayuda: undefined,
    error: null,
    requerido: false,
    deshabilitado: false,
    placeholder: "Seleccionar…",
    filtrable: undefined,
    cargando: false,
  },
);

const emit = defineEmits<{ "update:modelValue": [valor: string | null]; blur: [] }>();

// Filtro automático cuando hay muchas opciones (> 7).
const conFiltro = computed(() => props.filtrable ?? props.opciones.length > 7);
const opcionesMutables = computed(() => [...props.opciones]);
</script>

<template>
  <CampoBase
    :id="id"
    :etiqueta="etiqueta"
    :ayuda="ayuda"
    :error="error"
    :requerido="requerido"
    :deshabilitado="deshabilitado"
  >
    <template #default="campo">
      <Select
        :input-id="campo.id"
        :model-value="modelValue"
        :options="opcionesMutables"
        option-label="etiqueta"
        option-value="valor"
        option-disabled="deshabilitada"
        :placeholder="placeholder"
        :filter="conFiltro"
        filter-placeholder="Buscar…"
        empty-message="Sin resultados"
        empty-filter-message="Sin resultados"
        :loading="cargando"
        :disabled="deshabilitado"
        :invalid="campo.invalido"
        :aria-labelledby="campo.idEtiqueta"
        :pt="{
          label: {
            'aria-describedby': campo.describedby,
            'aria-required': requerido ? 'true' : undefined,
          },
        }"
        fluid
        class="min-h-11"
        @update:model-value="(v: string | null) => emit('update:modelValue', v)"
        @blur="emit('blur')"
      >
        <template #option="{ option }">
          <div class="flex flex-col">
            <span>{{ (option as OpcionSelector).etiqueta }}</span>
            <span v-if="(option as OpcionSelector).descripcion" class="text-sm text-texto-suave">
              {{ (option as OpcionSelector).descripcion }}
            </span>
          </div>
        </template>
      </Select>
    </template>
  </CampoBase>
</template>
