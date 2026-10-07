import { z } from "zod";
import { esquemaTrabajador, type Trabajador } from "@lavado-vehicular/shared/esquemas/trabajadores";
import "../mocks"; // registra los manejadores mock (solo se usan si el modo es "mock")
import { pedir } from "./cliente";
import type { Resultado } from "./tipos";

export function listarTrabajadores(): Promise<Resultado<Trabajador[]>> {
  return pedir({
    modulo: "trabajadores",
    metodo: "GET",
    ruta: "/api/trabajadores",
    esquemaRespuesta: z.array(esquemaTrabajador),
  });
}
