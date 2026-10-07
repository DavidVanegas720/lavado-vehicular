<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Precio, RangoCilindraje, Servicio } from "@lavado-vehicular/shared/esquemas/catalogo";
import { listarPrecios, listarRangos, listarServicios } from "@/api/catalogo";
import EncabezadoPagina from "@/componentes/base/EncabezadoPagina.vue";
import TablaBase, { type ColumnaTabla } from "@/componentes/base/TablaBase.vue";

interface FilaServicio {
  id: string;
  nombre: string;
  tipo: string;
  activo: string;
  [campo: string]: string | number | null;
}

type Estado = "cargando" | "ok" | "error";
const estado = ref<Estado>("cargando");
const servicios = ref<Servicio[]>([]);
const rangos = ref<RangoCilindraje[]>([]);
const precios = ref<Precio[]>([]);

async function cargar(): Promise<void> {
  estado.value = "cargando";
  const [s, r, p] = await Promise.all([listarServicios(), listarRangos(), listarPrecios()]);
  if (s.estado === "ok" && r.estado === "ok" && p.estado === "ok") {
    servicios.value = s.datos;
    rangos.value = r.datos;
    precios.value = p.datos;
    estado.value = "ok";
  } else {
    estado.value = "error";
  }
}
onMounted(cargar);

const rangosOrdenados = computed(() =>
  rangos.value
    .filter((r) => r.activo)
    .toSorted((a, b) => a.orden_visualizacion - b.orden_visualizacion),
);

const columnas = computed<ColumnaTabla[]>(() => [
  { campo: "nombre", encabezado: "Servicio", ordenable: true },
  { campo: "tipo", encabezado: "Tipo", ordenable: true },
  { campo: "activo", encabezado: "Activo" },
  ...rangosOrdenados.value.map((r): ColumnaTabla => ({
    campo: `precio_${r.id}`,
    encabezado: r.nombre,
    formato: "dinero",
    alinear: "derecha",
  })),
]);

const filas = computed<FilaServicio[]>(() =>
  servicios.value.map((s) => {
    const fila: FilaServicio = {
      id: s.id,
      nombre: s.nombre,
      tipo: s.tipo === "PAQUETE" ? "Paquete" : "Adicional",
      activo: s.activo ? "Sí" : "No",
    };
    for (const r of rangosOrdenados.value) {
      const precio = precios.value.find(
        (p) => p.servicio_id === s.id && p.rango_cilindraje_id === r.id,
      );
      fila[`precio_${r.id}`] = precio?.precio_centavos ?? null;
    }
    return fila;
  }),
);
</script>

<template>
  <section class="flex flex-col gap-6">
    <EncabezadoPagina titulo="Catálogo" subtitulo="Servicios y precios por rango de cilindraje" />
    <TablaBase
      :filas="filas"
      :columnas="columnas"
      clave-fila="id"
      etiqueta="Servicios y precios"
      :cargando="estado === 'cargando'"
      :error="estado === 'error'"
      texto-vacio="No hay servicios en el catálogo"
      @reintentar="cargar"
    />
  </section>
</template>
