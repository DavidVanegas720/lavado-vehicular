<script setup lang="ts">
import type { ResumenOrdenTablero } from "@lavado-vehicular/shared/esquemas/ordenes";
import { computed } from "vue";
import { useFormatoMoneda } from "@/composables/use-formato-moneda";
import BadgeEstado from "./BadgeEstado.vue";

const props = withDefaults(
  defineProps<{
    orden: ResumenOrdenTablero;
    compacta?: boolean;
    // P-TO1: se asume zona del negocio por defecto (America/Bogota, como el seed); la vista puede pasarla.
    zonaHoraria?: string;
  }>(),
  { compacta: false, zonaHoraria: "America/Bogota" },
);
const emit = defineEmits<{ seleccionar: [id: string] }>();
const { formatear } = useFormatoMoneda();

const anulada = computed(() => props.orden.estado === "ANULADA");
// P-TO2: se asume que el paquete es el primer ítem (por created_at) y el resto son adicionales.
const items = computed(() =>
  props.orden.items.toSorted((a, b) => a.created_at.localeCompare(b.created_at)),
);
const paquete = computed(() => items.value[0]?.servicio_nombre_congelado ?? "Sin servicios");
const adicionales = computed(() => Math.max(0, items.value.length - 1));
const hora = computed(() =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: props.zonaHoraria,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(props.orden.created_at)),
);
const trabajador = computed(() => props.orden.trabajador_nombre ?? "Sin asignar");
const etiquetaAccesible = computed(() => `Orden ${props.orden.placa}`);

function seleccionar(): void {
  emit("seleccionar", props.orden.id);
}
</script>

<template>
  <article
    tabindex="0"
    :aria-label="etiquetaAccesible"
    :data-estado="orden.estado"
    :class="[
      'flex min-h-11 flex-col rounded-tarjeta border border-borde bg-superficie text-texto shadow-suave',
      'cursor-pointer transition duration-150 ease-out hover:shadow-elevada motion-reduce:transition-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario',
      compacta ? 'gap-1 p-3' : 'gap-2 p-4',
      anulada ? 'opacity-60' : '',
    ]"
    @click="seleccionar"
    @keydown.enter.prevent="seleccionar"
  >
    <header class="flex items-start justify-between gap-2">
      <h3
        :class="[
          'font-bold tracking-wider',
          compacta ? 'text-grande' : 'text-xl',
          anulada ? 'line-through' : '',
        ]"
      >
        {{ orden.placa }}
      </h3>
      <BadgeEstado :estado="orden.estado" tamano="sm" />
    </header>
    <p class="text-base font-medium">
      {{ paquete }}
      <span v-if="adicionales > 0" class="text-pequeno text-texto-suave">
        +{{ adicionales }} {{ adicionales === 1 ? "adicional" : "adicionales" }}
      </span>
    </p>
    <p class="text-pequeno text-texto-suave">{{ orden.rango_cilindraje_nombre_congelado }}</p>
    <p class="text-pequeno text-texto-suave">
      <i class="pi pi-user" aria-hidden="true" /> {{ trabajador }}
    </p>
    <footer class="mt-1 flex items-center justify-between gap-2">
      <span class="text-pequeno text-texto-suave">{{ hora }}</span>
      <span
        v-if="orden.es_cortesia"
        class="rounded-full bg-info/15 px-2 py-0.5 text-pequeno font-medium text-info"
      >
        Cortesía
      </span>
      <span class="font-semibold">{{ formatear(orden.total_centavos) }}</span>
    </footer>
  </article>
</template>
