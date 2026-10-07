import { obtenerEstado } from "./estado";
import { registrarManejador } from "./registro";

export function registrarMocksTrabajadores(): void {
  registrarManejador("GET /api/trabajadores", () => ({
    estado: "ok",
    datos: obtenerEstado().trabajadores,
  }));
}
