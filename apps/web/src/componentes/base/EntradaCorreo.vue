<script setup lang="ts">
import CampoBase from "./CampoBase.vue";

withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    modelValue: string;
  }>(),
  { id: undefined, ayuda: undefined, error: null, requerido: false, deshabilitado: false },
);

const emit = defineEmits<{ "update:modelValue": [valor: string]; blur: [] }>();

function alEscribir(evento: Event): void {
  emit("update:modelValue", (evento.target as HTMLInputElement).value);
}

// Al salir se recortan los espacios de los extremos (típico al pegar un correo).
function alSalir(evento: Event): void {
  const campo = evento.target as HTMLInputElement;
  const recortado = campo.value.trim();
  if (recortado !== campo.value) {
    campo.value = recortado;
    emit("update:modelValue", recortado);
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
      <input
        :id="campo.id"
        type="email"
        autocomplete="email"
        :value="modelValue"
        :disabled="deshabilitado"
        :aria-invalid="campo.invalido ? 'true' : undefined"
        :aria-describedby="campo.describedby"
        :aria-required="requerido ? 'true' : undefined"
        class="min-h-11 w-full rounded-control border border-borde bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none aria-[invalid=true]:border-peligro disabled:opacity-50"
        @input="alEscribir"
        @blur="alSalir"
      />
    </template>
  </CampoBase>
</template>
