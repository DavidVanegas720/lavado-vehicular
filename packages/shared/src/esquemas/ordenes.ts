import { z } from "zod";
import { esquemaCentavos } from "../dominio/dinero";
import { esquemaPorcentajeBase10000 } from "../dominio/porcentaje";
import { esquemaDiaOperativo, esquemaFechaHora, esquemaId, esquemaTextoNoVacio } from "./comun";

export const ESTADOS_ORDEN = [
  "CREADA",
  "LAVANDO",
  "LISTA",
  "COBRADA",
  "ENTREGADA",
  "ANULADA",
] as const;
export const esquemaEstadoOrden = z.enum(ESTADOS_ORDEN);
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export const esquemaOrden = z
  .object({
    id: esquemaId,
    negocio_id: esquemaId,
    vehiculo_id: esquemaId,
    trabajador_id: esquemaId.nullable(),
    operador_id: esquemaId,
    rango_cilindraje_id: esquemaId,
    porcentaje_comision_congelado: esquemaPorcentajeBase10000, // H-01: no nulo, como en Prisma
    rango_cilindraje_nombre_congelado: esquemaTextoNoVacio,
    estado: esquemaEstadoOrden,
    es_cortesia: z.boolean(),
    motivo_cortesia: z.string().nullable(),
    motivo_anulacion: z.string().nullable(),
    orden_reemplaza_id: esquemaId.nullable(),
    dia_operativo: esquemaDiaOperativo,
    created_at: esquemaFechaHora,
    fecha_asignacion: esquemaFechaHora.nullable(),
    fecha_lavando: esquemaFechaHora.nullable(),
    fecha_lista: esquemaFechaHora.nullable(),
    fecha_cobro: esquemaFechaHora.nullable(),
    fecha_entrega: esquemaFechaHora.nullable(),
    fecha_anulacion: esquemaFechaHora.nullable(),
  })
  .superRefine((orden, contexto) => {
    if (orden.es_cortesia && (orden.motivo_cortesia ?? "").trim() === "") {
      contexto.addIssue({
        code: "custom",
        path: ["motivo_cortesia"],
        message: "Una cortesía exige un motivo",
      });
    }
    if (orden.estado === "ANULADA" && (orden.motivo_anulacion ?? "").trim() === "") {
      contexto.addIssue({
        code: "custom",
        path: ["motivo_anulacion"],
        message: "Una orden anulada exige un motivo de anulación",
      });
    }
  });

export type Orden = z.infer<typeof esquemaOrden>;

export const esquemaItemOrden = z.object({
  id: esquemaId,
  orden_id: esquemaId,
  servicio_id: esquemaId,
  servicio_nombre_congelado: esquemaTextoNoVacio,
  precio_centavos_congelado: esquemaCentavos,
  created_at: esquemaFechaHora,
});

export type ItemOrden = z.infer<typeof esquemaItemOrden>;

export const METODOS_PAGO = ["EFECTIVO", "QR", "OTRO"] as const;
export const esquemaMetodoPago = z.enum(METODOS_PAGO);
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const esquemaPago = z.object({
  id: esquemaId,
  orden_id: esquemaId,
  monto_centavos: esquemaCentavos,
  metodo: esquemaMetodoPago,
  concepto: z.string().nullable(),
  dia_operativo: esquemaDiaOperativo,
  created_at: esquemaFechaHora,
});

export type Pago = z.infer<typeof esquemaPago>;

export const TIPOS_EVENTO_ORDEN = [
  "CREADA",
  "ASIGNADA",
  "LAVANDO",
  "LISTA",
  "COBRADA",
  "ENTREGADA",
  "ANULADA",
  "ITEM_AGREGADO",
  "COMENTARIO",
] as const;
export const esquemaTipoEventoOrden = z.enum(TIPOS_EVENTO_ORDEN);
export type TipoEventoOrden = (typeof TIPOS_EVENTO_ORDEN)[number];

export const esquemaEventoOrden = z.object({
  id: esquemaId,
  orden_id: esquemaId,
  tipo: esquemaTipoEventoOrden,
  usuario_id: esquemaId,
  datos_json: z.record(z.string(), z.unknown()).nullable(),
  created_at: esquemaFechaHora,
});

export type EventoOrden = z.infer<typeof esquemaEventoOrden>;
