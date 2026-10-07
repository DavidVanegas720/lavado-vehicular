import { esquemaNegocio, type Negocio } from "@lavado-vehicular/shared/esquemas/negocio";
import "../mocks"; // registra los manejadores mock (solo se usan si el modo es "mock")
import { pedir } from "./cliente";
import type { Resultado } from "./tipos";

export function obtenerNegocioActual(): Promise<Resultado<Negocio>> {
  return pedir({
    modulo: "negocio",
    metodo: "GET",
    ruta: "/api/negocio/actual",
    esquemaRespuesta: esquemaNegocio,
  });
}
