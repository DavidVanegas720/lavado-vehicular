import { z } from "zod";
import { esquemaFechaHora, esquemaId, esquemaTextoNoVacio } from "./comun";

export const TIPOS_VEHICULO = ["MOTO", "CARRO"] as const;
export const esquemaTipoVehiculo = z.enum(TIPOS_VEHICULO);
export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];

export const esquemaVehiculo = z.object({
  id: esquemaId,
  negocio_id: esquemaId,
  tipo: esquemaTipoVehiculo,
  placa: esquemaTextoNoVacio,
  cilindraje: z.number().int().min(0).nullable(), // null si es carro
  primer_ingreso: esquemaFechaHora,
  updated_at: esquemaFechaHora,
});

export type Vehiculo = z.infer<typeof esquemaVehiculo>;
