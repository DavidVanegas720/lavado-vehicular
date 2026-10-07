<script setup lang="ts">
import { ref } from "vue";
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
    autocomplete: "current-password" | "new-password";
  }>(),
  { id: undefined, ayuda: undefined, error: null, requerido: false, deshabilitado: false },
);

const emit = defineEmits<{ "update:modelValue": [valor: string]; blur: [] }>();
const visible = ref(false);

function alEscribir(evento: Event): void {
  emit("update:modelValue", (evento.target as HTMLInputElement).value);
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
          :type="visible ? 'text' : 'password'"
          :autocomplete="autocomplete"
          :value="modelValue"
          :disabled="deshabilitado"
          :aria-invalid="campo.invalido ? 'true' : undefined"
          :aria-describedby="campo.describedby"
          :aria-required="requerido ? 'true' : undefined"
          class="min-h-11 w-full rounded-control border border-borde bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none aria-[invalid=true]:border-peligro disabled:opacity-50 pr-12"
          @input="alEscribir"
          @blur="emit('blur')"
        />
        <button
          type="button"
          :aria-pressed="visible"
          :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          :disabled="deshabilitado"
          class="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-control text-texto-suave focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none disabled:opacity-50"
          @click="visible = !visible"
        >
          <span :class="visible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></span>
        </button>
      </div>
    </template>
  </CampoBase>
</template>
