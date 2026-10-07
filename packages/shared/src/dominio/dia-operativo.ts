import { z } from "zod";

// La ÚNICA función de día operativo del sistema (regla 5, D-12). Nadie lo calcula a mano.

/** Fecha calendario "YYYY-MM-DD" en la zona horaria del negocio. */
export const esquemaDiaOperativo = z
  .string({ error: "El día operativo debe ser texto AAAA-MM-DD" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "El día operativo debe tener formato AAAA-MM-DD" })
  .refine(
    (texto) => {
      const [anio, mes, dia] = texto.split("-").map(Number);
      const fecha = new Date(Date.UTC(anio ?? 0, (mes ?? 1) - 1, dia ?? 1));
      // Zod 4 corre los refine aunque el regex falle: la fecha puede ser inválida (NaN).
      return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
    },
    { error: "El día operativo no es una fecha real" },
  )
  .brand<"DiaOperativo">();

export type DiaOperativo = z.infer<typeof esquemaDiaOperativo>;

export interface ConfigDiaOperativo {
  readonly zona_horaria: string;
  readonly hora_apertura: number;
  readonly hora_cierre: number;
}

export interface ResultadoDiaOperativo {
  readonly dia: DiaOperativo;
  readonly fueraDeHorario: boolean;
}

function validarConfig(config: ConfigDiaOperativo): void {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: config.zona_horaria });
  } catch {
    throw new Error(`Zona horaria inválida: "${config.zona_horaria}".`);
  }
  const { hora_apertura: apertura, hora_cierre: cierre } = config;
  if (!Number.isFinite(apertura) || !Number.isFinite(cierre)) {
    throw new Error("Las horas de apertura y cierre deben ser números.");
  }
  if (apertura < 0 || cierre > 24 || apertura >= cierre) {
    throw new Error("Horario inválido: se exige 0 <= apertura < cierre <= 24.");
  }
}

/**
 * Día operativo = fecha calendario del instante en la zona del negocio.
 * - Antes de la apertura: es el día de hoy (el negocio abre temprano), `fueraDeHorario` true.
 * - Después del cierre: también hoy, con `fueraDeHorario: true`.
 */
export function calcularDiaOperativo(
  instante: Date,
  config: ConfigDiaOperativo,
): ResultadoDiaOperativo {
  validarConfig(config);
  if (Number.isNaN(instante.getTime()))
    throw new Error("El instante recibido no es una fecha válida.");

  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.zona_horaria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);

  const valor = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? "";
  const dia = esquemaDiaOperativo.parse(`${valor("year")}-${valor("month")}-${valor("day")}`);
  const horaDecimal = Number(valor("hour")) + Number(valor("minute")) / 60;

  // P-F: se asume aceptar al día actual cuando está fuera de horario.
  const fueraDeHorario = horaDecimal < config.hora_apertura || horaDecimal >= config.hora_cierre;
  return { dia, fueraDeHorario };
}
