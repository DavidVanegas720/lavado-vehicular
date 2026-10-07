import { z } from "zod";
import { esquemaFechaHora, esquemaId, esquemaTextoNoVacio } from "./comun";

export const esquemaNegocio = z.object({
  id: esquemaId,
  nombre: esquemaTextoNoVacio,
  activo: z.boolean(),
  acepta_carros: z.boolean(),
  hora_apertura: z.number().int().min(0).max(24),
  hora_cierre: z.number().int().min(0).max(24),
  zona_horaria: esquemaTextoNoVacio,
  created_at: esquemaFechaHora,
  updated_at: esquemaFechaHora,
});

export type Negocio = z.infer<typeof esquemaNegocio>;
