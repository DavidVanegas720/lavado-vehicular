import { z } from "zod";
import { esquemaCentavos, esquemaCentavosConSigno } from "../dominio/dinero";
import { esquemaDiaOperativo, esquemaFechaHora, esquemaId } from "./comun";

export const esquemaCierreCaja = z
  .object({
    id: esquemaId,
    negocio_id: esquemaId,
    dia_operativo: esquemaDiaOperativo,
    total_esperado_centavos: esquemaCentavos,
    total_reportado_centavos: esquemaCentavos,
    diferencia_centavos: esquemaCentavosConSigno,
    notas: z.string().nullable(),
    cerrado_por_usuario_id: esquemaId,
    created_at: esquemaFechaHora,
  })
  .superRefine((cierre, contexto) => {
    if (cierre.diferencia_centavos !== cierre.total_reportado_centavos - cierre.total_esperado_centavos) {
      contexto.addIssue({
        code: "custom",
        path: ["diferencia_centavos"],
        message: "La diferencia debe ser lo reportado menos lo esperado",
      });
    }
  });

export type CierreCaja = z.infer<typeof esquemaCierreCaja>;
