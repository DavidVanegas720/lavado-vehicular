<script setup lang="ts">
import { watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import Button from "primevue/button";
import Drawer from "primevue/drawer";

export interface ItemNavegacion {
  etiqueta: string;
  ruta: string;
  icono: string;
}

defineProps<{ items: readonly ItemNavegacion[] }>();
const colapsada = defineModel<boolean>("colapsada", { default: false });
const abiertaMovil = defineModel<boolean>("abiertaMovil", { default: false });

const route = useRoute();
// Cierra el menú móvil al navegar.
watch(
  () => route.fullPath,
  () => {
    abiertaMovil.value = false;
  },
);
</script>

<template>
  <aside
    class="hidden shrink-0 flex-col border-r border-surface transition-[width] duration-200 md:flex"
    :class="colapsada ? 'w-16' : 'w-60'"
  >
    <nav aria-label="Principal" class="flex flex-1 flex-col gap-1 p-2">
      <RouterLink
        v-for="item in items"
        :key="item.ruta"
        :to="item.ruta"
        :title="colapsada ? item.etiqueta : undefined"
        :aria-label="colapsada ? item.etiqueta : undefined"
        class="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800 aria-[current=page]:bg-primario aria-[current=page]:text-primario-contraste"
        :class="colapsada ? 'justify-center' : ''"
      >
        <i :class="item.icono" aria-hidden="true" />
        <span v-if="!colapsada">{{ item.etiqueta }}</span>
      </RouterLink>
    </nav>
    <div class="p-2">
      <Button
        type="button"
        text
        rounded
        severity="secondary"
        :icon="colapsada ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
        :aria-label="colapsada ? 'Expandir barra lateral' : 'Contraer barra lateral'"
        :aria-expanded="!colapsada"
        @click="colapsada = !colapsada"
      />
    </div>
  </aside>

  <Drawer
    v-model:visible="abiertaMovil"
    header="Menú"
    :pt="{ root: { id: 'menu-movil' } }"
    class="md:!hidden"
  >
    <nav aria-label="Principal (móvil)" class="flex flex-col gap-1">
      <RouterLink
        v-for="item in items"
        :key="item.ruta"
        :to="item.ruta"
        class="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800 aria-[current=page]:bg-primario aria-[current=page]:text-primario-contraste"
      >
        <i :class="item.icono" aria-hidden="true" />
        <span>{{ item.etiqueta }}</span>
      </RouterLink>
    </nav>
  </Drawer>
</template>
