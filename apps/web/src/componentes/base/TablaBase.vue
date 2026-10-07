<script setup lang="ts" generic="T extends object">
import { computed, getCurrentInstance, onBeforeUnmount, ref, useId, watch } from "vue";
import type { Centavos } from "@lavado-vehicular/shared/dominio/dinero";
import { useFormatoMoneda } from "@/composables/use-formato-moneda";
import BotonSecundario from "./BotonSecundario.vue";
import EstadoVacio from "./EstadoVacio.vue";
import SkeletonCargando from "./SkeletonCargando.vue";

export interface ColumnaTabla {
  campo: string;
  encabezado: string;
  ordenable?: boolean;
  formato?: "texto" | "dinero" | "fecha-hora" | "dia";
  alinear?: "izquierda" | "centro" | "derecha";
}

const props = withDefaults(
  defineProps<{
    filas: readonly T[];
    columnas: readonly ColumnaTabla[];
    claveFila: Extract<keyof T, string>;
    cargando?: boolean;
    error?: boolean;
    tamanoPagina?: number;
    filtrable?: boolean;
    textoVacio?: string;
    /** Nombre accesible de la tabla. */
    etiqueta?: string;
  }>(),
  {
    cargando: false,
    error: false,
    tamanoPagina: 10,
    filtrable: false,
    textoVacio: "No hay datos para mostrar",
    etiqueta: "Tabla de datos",
  },
);

const emit = defineEmits<{ reintentar: []; "seleccionar-fila": [fila: T] }>();

const { formatear } = useFormatoMoneda();

// P-X: se asume la zona del negocio (America/Bogota) para fecha-hora; la tabla no recibe la config.
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const FORMATO_DIA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function aTexto(valor: unknown): string {
  return typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean"
    ? String(valor)
    : "";
}

function valorDe(fila: T, campo: string): unknown {
  return (fila as Record<string, unknown>)[campo];
}

function formatearCelda(columna: ColumnaTabla, fila: T): string {
  const valor = valorDe(fila, columna.campo);
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (columna.formato) {
    case "dinero":
      return formatear(valor as Centavos);
    case "fecha-hora":
      return FORMATO_FECHA_HORA.format(new Date(aTexto(valor)));
    case "dia": {
      const [a, m, d] = aTexto(valor).split("-").map(Number);
      return FORMATO_DIA.format(new Date(Date.UTC(a ?? 0, (m ?? 1) - 1, d ?? 1, 12)));
    }
    default:
      return typeof valor === "boolean" ? (valor ? "Sí" : "No") : aTexto(valor);
  }
}

function claseAlineacion(columna: ColumnaTabla): string {
  const alinear = columna.alinear ?? (columna.formato === "dinero" ? "derecha" : "izquierda");
  return alinear === "derecha" ? "text-right" : alinear === "centro" ? "text-center" : "text-left";
}

// Vista móvil (< 768 px): tarjetas apiladas, sin scroll horizontal.
const consulta = typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)") : null;
const esMovil = ref(consulta ? !consulta.matches : false);
function alCambiarVista(evento: { matches: boolean }): void {
  esMovil.value = !evento.matches;
}
consulta?.addEventListener("change", alCambiarVista);
onBeforeUnmount(() => consulta?.removeEventListener("change", alCambiarVista));

// Orden
const campoOrden = ref<string | null>(null);
const direccion = ref<"ascending" | "descending">("ascending");

function alternarOrden(columna: ColumnaTabla): void {
  if (campoOrden.value !== columna.campo) {
    campoOrden.value = columna.campo;
    direccion.value = "ascending";
  } else if (direccion.value === "ascending") {
    direccion.value = "descending";
  } else {
    campoOrden.value = null;
  }
}

function ariaSort(columna: ColumnaTabla): "ascending" | "descending" | "none" | undefined {
  if (!columna.ordenable) return undefined;
  return campoOrden.value === columna.campo ? direccion.value : "none";
}

// Filtro
const texto = ref("");
const idFiltro = useId();

const filasFiltradas = computed(() => {
  const q = texto.value.trim().toLocaleLowerCase("es");
  if (!q) return props.filas;
  return props.filas.filter((fila) =>
    props.columnas.some((c) => formatearCelda(c, fila).toLocaleLowerCase("es").includes(q)),
  );
});

const filasOrdenadas = computed(() => {
  const campo = campoOrden.value;
  if (!campo) return filasFiltradas.value;
  const factor = direccion.value === "ascending" ? 1 : -1;
  return [...filasFiltradas.value].sort((a, b) => {
    const va = valorDe(a, campo);
    const vb = valorDe(b, campo);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
    return aTexto(va).localeCompare(aTexto(vb), "es", { numeric: true }) * factor;
  });
});

// Paginación
const pagina = ref(1);
const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(filasOrdenadas.value.length / props.tamanoPagina)),
);
watch([texto, campoOrden, direccion, () => props.filas], () => {
  pagina.value = 1;
});
watch(totalPaginas, (total) => {
  if (pagina.value > total) pagina.value = total;
});
const filasVisibles = computed(() => {
  const inicio = (pagina.value - 1) * props.tamanoPagina;
  return filasOrdenadas.value.slice(inicio, inicio + props.tamanoPagina);
});

// Filas seleccionables solo si el padre escucha `seleccionar-fila`.
const instancia = getCurrentInstance();
const seleccionable = computed(() => Boolean(instancia?.vnode.props?.onSeleccionarFila));

function clave(fila: T): string {
  return aTexto(valorDe(fila, props.claveFila));
}
function seleccionar(fila: T): void {
  if (seleccionable.value) emit("seleccionar-fila", fila);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="filtrable && !cargando && !error" class="flex flex-col gap-1">
      <label :for="idFiltro" class="text-pequeno font-medium text-texto">Filtrar</label>
      <input
        :id="idFiltro"
        v-model="texto"
        type="search"
        autocomplete="off"
        class="min-h-11 w-full rounded-control border border-borde bg-superficie px-3 text-texto focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none sm:max-w-xs"
      />
    </div>

    <SkeletonCargando v-if="cargando" variante="tabla" />

    <EstadoVacio
      v-else-if="error"
      tono="error"
      icono="pi-exclamation-triangle"
      titulo="No se pudieron cargar los datos"
      descripcion="Revisa tu conexión e inténtalo de nuevo."
    >
      <template #accion>
        <BotonSecundario etiqueta="Reintentar" icono="pi-refresh" @click="emit('reintentar')" />
      </template>
    </EstadoVacio>

    <EstadoVacio
      v-else-if="filasOrdenadas.length === 0"
      icono="pi-inbox"
      :titulo="texto.trim() ? 'Sin resultados' : textoVacio"
      :descripcion="texto.trim() ? 'Ninguna fila coincide con el filtro.' : undefined"
    />

    <template v-else>
      <ul v-if="esMovil" :aria-label="etiqueta" class="flex flex-col gap-3">
        <li
          v-for="fila in filasVisibles"
          :key="clave(fila)"
          :tabindex="seleccionable ? 0 : undefined"
          :role="seleccionable ? 'button' : undefined"
          class="rounded-tarjeta border border-borde bg-superficie p-4 focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none"
          :class="{ 'cursor-pointer': seleccionable }"
          @click="seleccionar(fila)"
          @keydown.enter.self.prevent="seleccionar(fila)"
          @keydown.space.self.prevent="seleccionar(fila)"
        >
          <dl class="flex flex-col gap-2">
            <div
              v-for="columna in columnas"
              :key="columna.campo"
              class="flex items-baseline justify-between gap-4"
            >
              <dt class="text-pequeno text-texto-suave">{{ columna.encabezado }}</dt>
              <dd class="text-right text-texto">
                <slot
                  :name="`celda-${columna.campo}`"
                  :fila="fila"
                  :valor="valorDe(fila, columna.campo)"
                >
                  {{ formatearCelda(columna, fila) }}
                </slot>
              </dd>
            </div>
          </dl>
        </li>
      </ul>

      <div v-else class="overflow-x-auto rounded-tarjeta border border-borde">
        <table class="w-full border-collapse text-left">
          <caption class="sr-only">
            {{
              etiqueta
            }}
          </caption>
          <thead class="bg-superficie-elevada">
            <tr>
              <th
                v-for="columna in columnas"
                :key="columna.campo"
                scope="col"
                :aria-sort="ariaSort(columna)"
                class="border-b border-borde px-3 py-2 text-pequeno font-semibold text-texto-suave"
                :class="claseAlineacion(columna)"
              >
                <button
                  v-if="columna.ordenable"
                  type="button"
                  class="inline-flex min-h-11 items-center gap-1 rounded-control font-semibold focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none"
                  @click="alternarOrden(columna)"
                >
                  {{ columna.encabezado }}
                  <i
                    :class="[
                      'pi text-xs',
                      campoOrden === columna.campo
                        ? direccion === 'ascending'
                          ? 'pi-sort-amount-up-alt'
                          : 'pi-sort-amount-down'
                        : 'pi-sort-alt',
                    ]"
                    aria-hidden="true"
                  />
                </button>
                <template v-else>{{ columna.encabezado }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="fila in filasVisibles"
              :key="clave(fila)"
              :tabindex="seleccionable ? 0 : undefined"
              class="border-b border-borde last:border-b-0 focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none focus-visible:ring-inset"
              :class="{ 'cursor-pointer hover:bg-superficie-elevada': seleccionable }"
              @click="seleccionar(fila)"
              @keydown.enter.self.prevent="seleccionar(fila)"
            >
              <td
                v-for="columna in columnas"
                :key="columna.campo"
                class="px-3 py-3 text-texto"
                :class="claseAlineacion(columna)"
              >
                <slot
                  :name="`celda-${columna.campo}`"
                  :fila="fila"
                  :valor="valorDe(fila, columna.campo)"
                >
                  {{ formatearCelda(columna, fila) }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav
        v-if="totalPaginas > 1"
        aria-label="Paginación"
        class="flex items-center justify-between gap-3"
      >
        <BotonSecundario
          etiqueta="Anterior"
          icono="pi-chevron-left"
          :deshabilitado="pagina <= 1"
          @click="pagina -= 1"
        />
        <span class="text-pequeno text-texto-suave" aria-live="polite">
          Página {{ pagina }} de {{ totalPaginas }}
        </span>
        <BotonSecundario
          etiqueta="Siguiente"
          icono="pi-chevron-right"
          :deshabilitado="pagina >= totalPaginas"
          @click="pagina += 1"
        />
      </nav>
    </template>
  </div>
</template>
