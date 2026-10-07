<script setup lang="ts">
import { ref } from "vue";
import { RouterView, START_LOCATION, useRoute, useRouter } from "vue-router";
import { enfocarEncabezado } from "./foco";
import BarraLateral, { type ItemNavegacion } from "./BarraLateral.vue";
import BarraSuperior from "./BarraSuperior.vue";
import EnlaceSaltarContenido from "./EnlaceSaltarContenido.vue";

const items: readonly ItemNavegacion[] = [
  { etiqueta: "Tablero", ruta: "/tablero", icono: "pi pi-th-large" },
  { etiqueta: "Catálogo", ruta: "/catalogo", icono: "pi pi-tags" },
  { etiqueta: "Reportes", ruta: "/reportes", icono: "pi pi-chart-bar" },
];

function esDesktop(): boolean {
  try {
    return window.matchMedia("(min-width: 1024px)").matches;
  } catch {
    return true;
  }
}

const route = useRoute();
const router = useRouter();
// Tablet (768-1023 px) arranca colapsada; desktop expandida.
const colapsada = ref(!esDesktop());
const abiertaMovil = ref(false);

// En la carga inicial no se roba el foco (el skip link debe ser el primer Tab): solo se enfoca el h1
// una vez que ha habido una navegación posterior a la inicial.
let hayNavegacion = false;
router.afterEach((_destino, origen) => {
  if (origen !== START_LOCATION) hayNavegacion = true;
});
function alEntrarVista(): void {
  if (hayNavegacion) enfocarEncabezado();
}
</script>

<template>
  <div class="flex min-h-screen">
    <EnlaceSaltarContenido />
    <BarraLateral
      v-model:colapsada="colapsada"
      v-model:abierta-movil="abiertaMovil"
      :items="items"
    />
    <div class="flex min-w-0 flex-1 flex-col">
      <BarraSuperior
        :titulo="route.meta.titulo ?? 'Lavado Vehicular'"
        :menu-abierto="abiertaMovil"
        @alternar-menu="abiertaMovil = !abiertaMovil"
      />
      <main id="contenido" tabindex="-1" class="flex-1 p-4 outline-none md:p-6">
        <RouterView v-slot="{ Component }">
          <Transition name="pagina" mode="out-in" @after-enter="alEntrarVista">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style>
.pagina-enter-active,
.pagina-leave-active {
  transition:
    opacity 250ms ease,
    transform 250ms ease;
}
.pagina-enter-from,
.pagina-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
