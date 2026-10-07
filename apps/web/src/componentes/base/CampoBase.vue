<script setup lang="ts">
import { computed, useId } from "vue";

// Envoltorio común de todo campo: etiqueta, ayuda y error accesibles.
// El control concreto va en el slot por defecto y recibe los atributos ARIA ya calculados.
const props = withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    /** true cuando el control es un grupo (radiogroup): la etiqueta no apunta a un input. */
    grupo?: boolean;
  }>(),
  {
    id: undefined,
    ayuda: undefined,
    error: null,
    requerido: false,
    deshabilitado: false,
    grupo: false,
  },
);

const idGenerado = useId();
const idCampo = computed(() => props.id ?? idGenerado);
const idEtiqueta = computed(() => `${idCampo.value}-etiqueta`);
const idAyuda = computed(() => `${idCampo.value}-ayuda`);
const idError = computed(() => `${idCampo.value}-error`);

const describedby = computed(() => {
  const ids: string[] = [];
  if (props.ayuda) ids.push(idAyuda.value);
  if (props.error) ids.push(idError.value);
  return ids.length > 0 ? ids.join(" ") : undefined;
});
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <component
      :is="grupo ? 'span' : 'label'"
      :id="idEtiqueta"
      :for="grupo ? undefined : idCampo"
      class="text-sm font-medium text-texto"
    >
      {{ etiqueta }}
      <span v-if="requerido" class="text-peligro" aria-hidden="true"> *</span>
    </component>
    <slot
      :id="idCampo"
      :id-etiqueta="idEtiqueta"
      :describedby="describedby"
      :invalido="Boolean(error)"
      :requerido="requerido"
      :deshabilitado="deshabilitado"
    />
    <p v-if="ayuda" :id="idAyuda" class="text-sm text-texto-suave">{{ ayuda }}</p>
    <p :id="idError" aria-live="polite" class="text-sm text-peligro">
      <template v-if="error">
        <span class="pi pi-exclamation-circle mr-1" aria-hidden="true"></span>{{ error }}
      </template>
    </p>
  </div>
</template>
