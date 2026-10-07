<script setup lang="ts">
import type { Centavos } from "@lavado-vehicular/shared/dominio/dinero";
import { computed } from "vue";
import { formatear, parsearPesos } from "../../composables/use-formato-moneda";
import CampoBase from "./CampoBase.vue";

const props = withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    modelValue: Centavos | null;
    min?: Centavos;
    max?: Centavos;
    permiteCero?: boolean;
  }>(),
  {
    id: undefined,
    ayuda: undefined,
    error: null,
    requerido: false,
    deshabilitado: false,
    min: undefined,
    max: undefined,
    permiteCero: false,
  },
);

const emit = defineEmits<{ "update:modelValue": [valor: Centavos | null]; blur: [] }>();

const texto = computed(() => (props.modelValue === null ? "" : formatear(props.modelValue)));

// El usuario escribe pesos enteros; `parsearPesos` los vuelve centavos (nunca hay no-enteros).
function alEscribir(evento: Event): void {
  const campo = evento.target as HTMLInputElement;
  const nuevo = parsearPesos(campo.value);
  const fuera = campo.value.replace(/\D/g, "") !== "" && nuevo === null;
  const excede = nuevo !== null && props.max !== undefined && nuevo > props.max;
  if (fuera || excede) {
    campo.value = texto.value; // se rechaza el dígito: se conserva el valor anterior
    return;
  }
  const valor = nuevo === 0 && !props.permiteCero ? null : nuevo;
  campo.value = valor === null ? "" : formatear(valor);
  emit("update:modelValue", valor);
}

// El mínimo se aplica al salir, para no estorbar mientras se teclea.
function alSalir(evento: Event): void {
  const campo = evento.target as HTMLInputElement;
  if (props.modelValue !== null && props.min !== undefined && props.modelValue < props.min) {
    campo.value = formatear(props.min);
    emit("update:modelValue", props.min);
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
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="$ 0"
        :value="texto"
        :disabled="deshabilitado"
        :aria-invalid="campo.invalido ? 'true' : undefined"
        :aria-describedby="campo.describedby"
        :aria-required="requerido ? 'true' : undefined"
        class="min-h-11 w-full rounded-control border border-borde bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none aria-[invalid=true]:border-peligro disabled:opacity-50 tabular-nums"
        @input="alEscribir"
        @blur="alSalir"
      />
    </template>
  </CampoBase>
</template>
