<script setup lang="ts">
import {
  calcularDiaOperativo,
  type ConfigDiaOperativo,
  type DiaOperativo,
} from "@lavado-vehicular/shared/dominio/dia-operativo";
import { computed, ref, watch } from "vue";
import BotonSecundario from "./BotonSecundario.vue";
import CampoBase from "./CampoBase.vue";

export interface RangoFechas {
  desde: DiaOperativo;
  hasta: DiaOperativo;
}

const props = withDefaults(
  defineProps<{
    id?: string;
    etiqueta: string;
    ayuda?: string;
    error?: string | null;
    requerido?: boolean;
    deshabilitado?: boolean;
    modelValue: RangoFechas | null;
    atajos?: boolean;
    /** Último día seleccionable; por defecto el día operativo actual. */
    maximo?: DiaOperativo;
  }>(),
  {
    id: undefined,
    ayuda: undefined,
    error: null,
    requerido: false,
    deshabilitado: false,
    atajos: true,
    maximo: undefined,
  },
);

const emit = defineEmits<{ "update:modelValue": [valor: RangoFechas | null]; blur: [] }>();

// P-X: se asume la configuración del negocio (Bogotá, 8–17) hasta que exista el módulo de configuración.
const CONFIG_NEGOCIO: ConfigDiaOperativo = {
  zona_horaria: "America/Bogota",
  hora_apertura: 8,
  hora_cierre: 17,
};

const tope = computed<string>(
  () => props.maximo ?? calcularDiaOperativo(new Date(), CONFIG_NEGOCIO).dia,
);

const desde = ref<string>(props.modelValue?.desde ?? "");
const hasta = ref<string>(props.modelValue?.hasta ?? "");

watch(
  () => props.modelValue,
  (valor) => {
    if (valor) {
      desde.value = valor.desde;
      hasta.value = valor.hasta;
    } else if (desde.value && hasta.value) {
      desde.value = "";
      hasta.value = "";
    }
  },
);

// Aritmética de calendario en UTC sobre texto AAAA-MM-DD: el `Date` nunca sale del componente.
function aFecha(dia: string): Date {
  const [anio, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(anio ?? 0, (mes ?? 1) - 1, d ?? 1));
}
function aDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
function sumarDias(dia: string, n: number): string {
  const f = aFecha(dia);
  f.setUTCDate(f.getUTCDate() + n);
  return aDia(f);
}
const minimoDe = (a: string, b: string): string => (a <= b ? a : b);

function emitir(d: string, h: string): void {
  if (d && h) {
    emit("update:modelValue", { desde: d as DiaOperativo, hasta: h as DiaOperativo });
  } else if (props.modelValue) {
    emit("update:modelValue", null);
  }
}

function cambiarDesde(evento: Event): void {
  let d = (evento.target as HTMLInputElement).value;
  if (d > tope.value) d = tope.value;
  desde.value = d;
  // Mantiene desde <= hasta moviendo el otro extremo.
  if (d && hasta.value && d > hasta.value) hasta.value = d;
  emitir(desde.value, hasta.value);
}

function cambiarHasta(evento: Event): void {
  let h = (evento.target as HTMLInputElement).value;
  if (h > tope.value) h = tope.value;
  hasta.value = h;
  if (h && desde.value && h < desde.value) desde.value = h;
  emitir(desde.value, hasta.value);
}

function aplicar(d: string, h: string): void {
  desde.value = d;
  hasta.value = h;
  emitir(d, h);
}

const atajosDefinidos = computed(() => {
  const hoy = tope.value;
  const f = aFecha(hoy);
  // H-08: se asume semana lunes–domingo.
  const lunes = sumarDias(hoy, -((f.getUTCDay() + 6) % 7));
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const finMesAnterior = sumarDias(inicioMes, -1);
  const inicioMesAnterior = `${finMesAnterior.slice(0, 8)}01`;
  return [
    { etiqueta: "Hoy", desde: hoy, hasta: hoy },
    { etiqueta: "Esta semana", desde: lunes, hasta: minimoDe(sumarDias(lunes, 6), hoy) },
    { etiqueta: "Este mes", desde: inicioMes, hasta: hoy },
    { etiqueta: "Mes anterior", desde: inicioMesAnterior, hasta: finMesAnterior },
  ];
});

const claseEntrada =
  "min-h-11 w-full rounded-control border border-borde bg-superficie px-3 py-2 text-texto focus-visible:ring-2 focus-visible:ring-primario focus-visible:outline-none aria-[invalid=true]:border-peligro disabled:opacity-50";
</script>

<template>
  <CampoBase
    :id="id"
    :etiqueta="etiqueta"
    :ayuda="ayuda"
    :error="error"
    :requerido="requerido"
    :deshabilitado="deshabilitado"
    grupo
  >
    <template #default="campo">
      <div
        role="group"
        :aria-labelledby="campo.idEtiqueta"
        :aria-describedby="campo.describedby"
        class="flex flex-col gap-3"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-1 text-sm text-texto-suave">
            Desde
            <input
              :id="campo.id"
              type="date"
              :value="desde"
              :max="tope"
              :disabled="deshabilitado"
              :aria-invalid="campo.invalido ? 'true' : undefined"
              :class="claseEntrada"
              @change="cambiarDesde"
              @blur="emit('blur')"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-texto-suave">
            Hasta
            <input
              type="date"
              :value="hasta"
              :min="desde || undefined"
              :max="tope"
              :disabled="deshabilitado"
              :aria-invalid="campo.invalido ? 'true' : undefined"
              :class="claseEntrada"
              @change="cambiarHasta"
              @blur="emit('blur')"
            />
          </label>
        </div>
        <div v-if="atajos" class="flex flex-wrap gap-2">
          <BotonSecundario
            v-for="a in atajosDefinidos"
            :key="a.etiqueta"
            :etiqueta="a.etiqueta"
            :deshabilitado="deshabilitado"
            @click="aplicar(a.desde, a.hasta)"
          />
        </div>
      </div>
    </template>
  </CampoBase>
</template>
