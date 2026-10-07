import { z } from "zod";
import {
  esquemaResumenOrdenTablero,
  type ResumenOrdenTablero,
} from "@lavado-vehicular/shared/esquemas/ordenes";
import "../mocks"; // registra los manejadores mock (solo se usan si el modo es "mock")
import { pedir } from "./cliente";
import type { Resultado } from "./tipos";

/** `dia` = "AAAA-MM-DD"; sin él, el día operativo actual. Ordenadas por `created_at`. */
export function listarTableroDelDia(dia?: string): Promise<Resultado<ResumenOrdenTablero[]>> {
  return pedir({
    modulo: "ordenes",
    metodo: "GET",
    ruta: "/api/ordenes/tablero",
    consulta: dia === undefined ? undefined : { dia },
    esquemaRespuesta: z.array(esquemaResumenOrdenTablero),
  });
}
