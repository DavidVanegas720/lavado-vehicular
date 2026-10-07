<script setup lang="ts">
import CampoBase from "./CampoBase.vue";

const props = withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    modelValue: number | null;
    min?: number;
    max?: number;
    sufijo?: string;
  }>(),
  {
    id: undefined,
    ayuda: undefined,
    error: null,
    requerido: false,
    deshabilitado: false,
    min: undefined,
    max: undefined,
    sufijo: undefined,
  },
);

const emit = defineEmits<{ "update:modelValue": [valor: number | null]; blur: [] }>();

// Solo enteros: se descartan decimales, signos y letras mientras se escribe.
function alEscribir(evento: Event): void {
  const campo = evento.target as HTMLInputElement;
  const digitos = campo.value.replace(/\D/g, "");
  const numero = digitos === "" ? null : Number(digitos);
  if (numero !== null && !Number.isSafeInteger(numero)) {
    campo.value = props.modelValue === null ? "" : String(props.modelValue);
    return;
  }
  campo.value = digitos;
  emit("update:modelValue", numero);
}

// Los límites se aplican al salir, para no estorbar mientras se teclea.
function alSalir(evento: Event): void {
  const campo = evento.target as HTMLInputElement;
  if (campo.value !== "") {
    let numero = Number(campo.value);
    if (props.min !== undefined && numero < props.min) numero = props.min;
    if (props.max !== undefined && numero > props.max) numero = props.max;
    if (numero !== Number(campo.value)) {
      campo.value = String(numero);
      emit("update:modelValue", numero);
    }
  }
  emit("blur");
}
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
      <div class="relative">
        <input
          :id="campo.id"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :value="modelValue === null ? '' : String(modelValue)"
          :disabled="deshabilitado"
          :aria-invalid="campo.invalido ? 'true' : undefined"
          :aria-describedby="campo.describedby"
          :aria-required="requerido ? 'true' : undefined"
          :aria-valuemin="min"
          :aria-valuemax="max"
          :class="[
            'min-h-11 w-full rounded-control border border-borde bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none aria-[invalid=true]:border-peligro disabled:opacity-50',
            sufijo ? 'pr-12' : '',
          ]"
          @input="alEscribir"
          @blur="alSalir"
        />
        <span
          v-if="sufijo"
          class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-texto-suave"
          aria-hidden="true"
        >
          {{ sufijo }}
        </span>
      </div>
    </template>
  </CampoBase>
</template>
