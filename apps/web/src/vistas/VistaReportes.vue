<script setup lang="ts">
import { ref } from "vue";
import EncabezadoPagina from "@/componentes/base/EncabezadoPagina.vue";
import EstadoVacio from "@/componentes/base/EstadoVacio.vue";
import type { DiaOperativo } from "@lavado-vehicular/shared/dominio/dia-operativo";
import SelectorRangoFechas from "@/componentes/base/SelectorRangoFechas.vue";

const rango = ref<{ desde: DiaOperativo; hasta: DiaOperativo } | null>(null);
</script>

<template>
  <section class="flex flex-col gap-6">
    <EncabezadoPagina titulo="Reportes" subtitulo="Cierres de caja y comisiones" />
    <SelectorRangoFechas v-model="rango" etiqueta="Periodo del reporte" />
    <EstadoVacio
      icono="pi-chart-bar"
      titulo="Los reportes llegan en F1-5"
      descripcion="Aquí verás ventas, comisiones y cierres de caja del periodo elegido."
    />
  </section>
</template>
