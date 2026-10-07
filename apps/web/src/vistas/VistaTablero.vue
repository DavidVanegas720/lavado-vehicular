<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { ResumenOrdenTablero } from "@lavado-vehicular/shared/esquemas/ordenes";
import { obtenerNegocioActual } from "@/api/negocio";
import { listarTableroDelDia } from "@/api/ordenes";
import type { Resultado } from "@/api/tipos";
import BotonSecundario from "@/componentes/base/BotonSecundario.vue";
import EncabezadoPagina from "@/componentes/base/EncabezadoPagina.vue";
import EstadoVacio from "@/componentes/base/EstadoVacio.vue";
import SkeletonCargando from "@/componentes/base/SkeletonCargando.vue";
import TarjetaOrden from "@/componentes/dominio/TarjetaOrden.vue";
import { useDiaOperativo } from "@/composables/use-dia-operativo";

// P-X: se asume Bogotá 8–17 mientras llega la configuración real del negocio (H-07).
const configPorDefecto = { zona_horaria: "America/Bogota", hora_apertura: 8, hora_cierre: 17 };
const config = ref(configPorDefecto);
const { diaActual, formatearDia } = useDiaOperativo(config);

// `null` = cargando.
const resultado = ref<Resultado<ResumenOrdenTablero[]> | null>(null);

async function cargar(): Promise<void> {
  resultado.value = null;
  resultado.value = await listarTableroDelDia();
}

onMounted(async () => {
  void cargar();
  const negocio = await obtenerNegocioActual();
  if (negocio.estado === "ok") config.value = negocio.datos;
});

const subtitulo = computed(() => formatearDia(diaActual.value));

function mensajeError(r: Exclude<Resultado<unknown>, { estado: "ok" }>): string {
  switch (r.estado) {
    case "no-autenticado":
      return "Tu sesión no es válida. Vuelve a iniciar sesión.";
    case "espera":
      return `Demasiadas solicitudes. Intenta de nuevo en ${String(r.segundos)} s.`;
    case "sin-respuesta":
      return "No hay conexión con el servidor.";
    case "servidor":
      return r.mensaje;
  }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <EncabezadoPagina titulo="Tablero del día" :subtitulo="subtitulo" />

    <SkeletonCargando v-if="resultado === null" variante="tarjeta" />
    <template v-else-if="resultado.estado === 'ok'">
      <EstadoVacio
        v-if="resultado.datos.length === 0"
        icono="pi-inbox"
        titulo="Aún no hay órdenes hoy"
        descripcion="Cuando se cree la primera orden del día aparecerá aquí."
      />
      <TransitionGroup
        v-else
        tag="ul"
        name="lista"
        class="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        aria-label="Órdenes del día"
      >
        <li v-for="orden in resultado.datos" :key="orden.id">
          <TarjetaOrden :orden="orden" :zona-horaria="config.zona_horaria" />
        </li>
      </TransitionGroup>
    </template>
    <EstadoVacio
      v-else
      tono="error"
      icono="pi-exclamation-triangle"
      titulo="No se pudo cargar el tablero"
      :descripcion="mensajeError(resultado)"
    >
      <template #accion>
        <BotonSecundario etiqueta="Reintentar" icono="pi-refresh" @click="cargar" />
      </template>
    </EstadoVacio>
  </section>
</template>

<style>
.lista-enter-active,
.lista-leave-active {
  transition:
    opacity 400ms ease,
    transform 400ms ease;
}
.lista-enter-from,
.lista-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
