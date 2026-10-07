<script setup lang="ts">
import { computed } from "vue";
import Button from "primevue/button";
import { useTema } from "@/composables/use-tema";

const { tema, alternar } = useTema();
const esOscuro = computed(() => tema.value === "oscuro");
const etiqueta = computed(() =>
  esOscuro.value ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
);
</script>

<template>
  <Button
    type="button"
    text
    rounded
    severity="secondary"
    :icon="esOscuro ? 'pi pi-sun' : 'pi pi-moon'"
    :aria-label="etiqueta"
    :aria-pressed="esOscuro"
    @click="alternar"
  />
</template>
