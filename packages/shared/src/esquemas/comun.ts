import { z } from "zod";
import { esquemaDiaOperativo } from "../dominio/dia-operativo";

export { esquemaDiaOperativo };

/** Id opaco (cuid de Prisma). No se valida como UUID: ver E-002. */
export const esquemaId = z
  .string({ error: "El id debe ser texto" })
  .min(1, { error: "El id no puede estar vacío" });

/** Fecha-hora ISO 8601 en UTC (por ejemplo `2026-10-07T15:00:00.000Z`). */
export const esquemaFechaHora = z.iso.datetime({ error: "Debe ser una fecha-hora ISO 8601 en UTC" });

/** Texto obligatorio no vacío (nombres, motivos). */
export const esquemaTextoNoVacio = z
  .string({ error: "Debe ser texto" })
  .trim()
  .min(1, { error: "No puede estar vacío" });
