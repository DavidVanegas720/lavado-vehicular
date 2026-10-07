import { z } from "zod";
import { esquemaCentavos } from "../dominio/dinero";
import { esquemaFechaHora, esquemaId, esquemaTextoNoVacio } from "./comun";

export const esquemaRangoCilindraje = z
  .object({
    id: esquemaId,
    negocio_id: esquemaId,
    nombre: esquemaTextoNoVacio,
    cc_min: z.number().int().min(0),
    cc_max: z.number().int().min(0).nullable(), // null = "en adelante"
    orden_visualizacion: z.number().int(),
    activo: z.boolean(),
    created_at: esquemaFechaHora,
    updated_at: esquemaFechaHora,
  })
  .superRefine((rango, contexto) => {
    if (rango.cc_max !== null && rango.cc_max < rango.cc_min) {
      contexto.addIssue({
        code: "custom",
        path: ["cc_max"],
        message: "El cilindraje máximo no puede ser menor que el mínimo",
      });
    }
  });

export type RangoCilindraje = z.infer<typeof esquemaRangoCilindraje>;

export const TIPOS_SERVICIO = ["PAQUETE", "ADICIONAL"] as const;
export const esquemaTipoServicio = z.enum(TIPOS_SERVICIO);
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];

export const esquemaServicio = z.object({
  id: esquemaId,
  negocio_id: esquemaId,
  tipo: esquemaTipoServicio,
  nombre: esquemaTextoNoVacio,
  descripcion: z.string().nullable(),
  activo: z.boolean(),
  created_at: esquemaFechaHora,
  updated_at: esquemaFechaHora,
});

export type Servicio = z.infer<typeof esquemaServicio>;

export const esquemaPrecio = z.object({
  id: esquemaId,
  servicio_id: esquemaId,
  rango_cilindraje_id: esquemaId,
  precio_centavos: esquemaCentavos,
  created_at: esquemaFechaHora,
  updated_at: esquemaFechaHora,
});

export type Precio = z.infer<typeof esquemaPrecio>;
