import { obtenerEstado } from "./estado";
import { registrarManejador } from "./registro";

/** H-07: la configuración del negocio aún no tiene módulo propio. */
export function registrarMocksNegocio(): void {
  registrarManejador("GET /api/negocio/actual", () => ({
    estado: "ok",
    datos: obtenerEstado().negocio,
  }));
}
