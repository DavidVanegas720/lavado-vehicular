<script setup lang="ts">
import BotonBase from "./BotonBase.vue";

withDefaults(
  defineProps<{
    etiqueta: string;
    icono?: string;
    soloIcono?: boolean;
    ariaLabel?: string;
    cargando?: boolean;
    deshabilitado?: boolean;
    tipo?: "button" | "submit";
    bloque?: boolean;
  }>(),
  { tipo: "button" },
);

const emit = defineEmits<{ click: [evento: MouseEvent] }>();
</script>

<template>
  <BotonBase
    variante="principal"
    :etiqueta="etiqueta"
    :icono="icono"
    :solo-icono="soloIcono"
    :aria-label="ariaLabel"
    :cargando="cargando"
    :deshabilitado="deshabilitado"
    :tipo="tipo"
    :bloque="bloque"
    @click="emit('click', $event)"
  />
</template>
