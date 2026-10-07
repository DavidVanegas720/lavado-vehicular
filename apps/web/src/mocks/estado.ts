import { ahora } from "./reloj";
import { crearSeed, type EstadoMock } from "./seed";

// Estado en memoria (no `localStorage`). Las mutaciones futuras nunca eliminan de los arreglos.
let estado: EstadoMock | null = null;

/** Crea el seed perezosamente con la hora actual del reloj. */
export function obtenerEstado(): EstadoMock {
  estado ??= crearSeed(ahora());
  return estado;
}

/** Descarta el estado para que el próximo `obtenerEstado()` regenere el seed (tests). */
export function reiniciarEstadoMock(): void {
  estado = null;
}
