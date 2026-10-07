import { z } from "zod";
import { esquemaPorcentajeBase10000 } from "../dominio/porcentaje";
import { esquemaFechaHora, esquemaId, esquemaTextoNoVacio } from "./comun";

export const esquemaTrabajador = z.object({
  id: esquemaId,
  negocio_id: esquemaId,
  nombre: esquemaTextoNoVacio,
  activo: z.boolean(),
  created_at: esquemaFechaHora,
  updated_at: esquemaFechaHora,
});

export type Trabajador = z.infer<typeof esquemaTrabajador>;

export const esquemaAcuerdoComision = z.object({
  id: esquemaId,
  trabajador_id: esquemaId,
  porcentaje_base: esquemaPorcentajeBase10000,
  fecha_inicio: esquemaFechaHora,
  fecha_fin: esquemaFechaHora.nullable(), // null = vigente
  created_at: esquemaFechaHora,
});

export type AcuerdoComision = z.infer<typeof esquemaAcuerdoComision>;
