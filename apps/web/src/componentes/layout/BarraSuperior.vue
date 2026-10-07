<script setup lang="ts">
import Button from "primevue/button";
import BotonTema from "./BotonTema.vue";

defineProps<{
  titulo: string;
  /** Estado del menú móvil, para `aria-expanded`. */
  menuAbierto?: boolean;
}>();
defineEmits<{ "alternar-menu": [] }>();
</script>

<template>
  <header class="flex h-14 items-center gap-2 border-b border-surface px-4">
    <Button
      type="button"
      class="md:!hidden"
      text
      rounded
      severity="secondary"
      icon="pi pi-bars"
      aria-label="Abrir menú"
      aria-controls="menu-movil"
      :aria-expanded="menuAbierto ?? false"
      @click="$emit('alternar-menu')"
    />
    <p class="flex-1 truncate text-lg font-semibold">{{ titulo }}</p>
    <slot name="usuario">
      <!-- Placeholder hasta F1-2 (autenticación). -->
      <span class="hidden text-sm text-muted-color sm:inline">Usuario</span>
    </slot>
    <BotonTema />
  </header>
</template>
