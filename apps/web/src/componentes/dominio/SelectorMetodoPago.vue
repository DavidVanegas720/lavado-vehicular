<script setup lang="ts">
import { METODOS_PAGO, type MetodoPago } from "@lavado-vehicular/shared/esquemas/ordenes";
import { useTemplateRef } from "vue";
import CampoBase from "../base/CampoBase.vue";

const props = withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    modelValue: MetodoPago | null;
  }>(),
  { id: undefined, ayuda: undefined, error: null, requerido: false, deshabilitado: false },
);

const emit = defineEmits<{ "update:modelValue": [valor: MetodoPago | null]; blur: [] }>();

const ETIQUETAS: Record<MetodoPago, { texto: string; icono: string }> = {
  EFECTIVO: { texto: "Efectivo", icono: "pi pi-money-bill" },
  QR: { texto: "QR", icono: "pi pi-qrcode" },
  OTRO: { texto: "Otro", icono: "pi pi-ellipsis-h" },
};

const botones = useTemplateRef<HTMLButtonElement[]>("botones");

// Roving tabindex: solo el seleccionado (o el primero si no hay selección) entra con Tab.
function esTabulable(metodo: MetodoPago, indice: number): boolean {
  return props.modelValue === null ? indice === 0 : props.modelValue === metodo;
}

function elegir(metodo: MetodoPago): void {
  if (props.deshabilitado) return;
  emit("update:modelValue", metodo);
}

function alTeclear(evento: KeyboardEvent, indice: number): void {
  const paso =
    evento.key === "ArrowRight" || evento.key === "ArrowDown"
      ? 1
      : evento.key === "ArrowLeft" || evento.key === "ArrowUp"
        ? -1
        : 0;
  if (paso === 0) return;
  evento.preventDefault();
  const siguiente = (indice + paso + METODOS_PAGO.length) % METODOS_PAGO.length;
  const metodo = METODOS_PAGO[siguiente];
  if (metodo === undefined) return;
  elegir(metodo);
  botones.value?.[siguiente]?.focus();
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
    grupo
  >
    <template #default="campo">
      <div
        :id="campo.id"
        role="radiogroup"
        :aria-labelledby="campo.idEtiqueta"
        :aria-describedby="campo.describedby"
        :aria-invalid="campo.invalido ? 'true' : undefined"
        :aria-required="requerido ? 'true' : undefined"
        class="grid grid-cols-3 gap-2"
        @focusout="emit('blur')"
      >
        <button
          v-for="(metodo, indice) in METODOS_PAGO"
          :key="metodo"
          ref="botones"
          type="button"
          role="radio"
          :aria-checked="modelValue === metodo"
          :tabindex="esTabulable(metodo, indice) ? 0 : -1"
          :disabled="deshabilitado"
          :class="[
            'flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none',
            'focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none disabled:opacity-50',
            modelValue === metodo
              ? 'border-primario bg-primario text-primario-contraste'
              : 'border-borde bg-superficie text-texto hover:bg-fondo',
          ]"
          @click="elegir(metodo)"
          @keydown="alTeclear($event, indice)"
        >
          <span :class="ETIQUETAS[metodo].icono" aria-hidden="true"></span>
          {{ ETIQUETAS[metodo].texto }}
        </button>
      </div>
    </template>
  </CampoBase>
</template>
