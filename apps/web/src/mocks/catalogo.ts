import { obtenerEstado } from "./estado";
import { registrarManejador } from "./registro";

export function registrarMocksCatalogo(): void {
  registrarManejador("GET /api/catalogo/servicios", () => ({
    estado: "ok",
    datos: obtenerEstado().servicios,
  }));
  registrarManejador("GET /api/catalogo/rangos", () => ({
    estado: "ok",
    datos: obtenerEstado().rangos,
  }));
  registrarManejador("GET /api/catalogo/precios", () => ({
    estado: "ok",
    datos: obtenerEstado().precios,
  }));
}
