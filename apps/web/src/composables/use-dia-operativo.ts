import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import {
  calcularDiaOperativo,
  type ConfigDiaOperativo,
  type DiaOperativo,
} from "@lavado-vehicular/shared/dominio/dia-operativo";

const INTERVALO_MS = 60_000;

/** Envuelve `calcularDiaOperativo` de shared (regla 5); no recalcula nada. */
export function useDiaOperativo(config: MaybeRefOrGetter<ConfigDiaOperativo>): {
  diaActual: ComputedRef<DiaOperativo>;
  fueraDeHorario: ComputedRef<boolean>;
  formatearDia: (dia: string) => string;
  formatearHora: (isoUtc: string) => string;
} {
  const ahora = ref(new Date());
  const temporizador = setInterval(() => {
    ahora.value = new Date();
  }, INTERVALO_MS);
  onScopeDispose(() => {
    clearInterval(temporizador);
  });

  const resultado = computed(() => calcularDiaOperativo(ahora.value, toValue(config)));
  const diaActual = computed(() => resultado.value.dia);
  const fueraDeHorario = computed(() => resultado.value.fueraDeHorario);

  function formatearDia(dia: string): string {
    const [anio, mes, d] = dia.split("-").map(Number);
    // Mediodía UTC en zona UTC: el día calendario no se desplaza.
    const fecha = new Date(Date.UTC(anio ?? 0, (mes ?? 1) - 1, d ?? 1, 12));
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(fecha);
  }

  function formatearHora(isoUtc: string): string {
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: toValue(config).zona_horaria,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(isoUtc));
  }

  return { diaActual, fueraDeHorario, formatearDia, formatearHora };
}
