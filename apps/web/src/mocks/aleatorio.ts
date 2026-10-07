// PRNG con semilla fija (mulberry32). Prohibido `Math.random` en mocks (DM-10).

export interface Aleatorio {
  /** Número en [0, 1). */
  siguiente: () => number;
  /** Entero en [min, max] (ambos incluidos). */
  entero: (min: number, max: number) => number;
  /** Elemento del arreglo (no vacío). */
  elegir: <T>(elementos: readonly T[]) => T;
}

export const SEMILLA_MOCK = 20261007;

export function crearAleatorio(semilla: number = SEMILLA_MOCK): Aleatorio {
  let estado = semilla >>> 0;
  const siguiente = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (min: number, max: number): number =>
    min + Math.floor(siguiente() * (max - min + 1));
  const elegir = <T>(elementos: readonly T[]): T => {
    const elemento = elementos[entero(0, elementos.length - 1)];
    if (elemento === undefined) throw new Error("No se puede elegir de una lista vacía.");
    return elemento;
  };
  return { siguiente, entero, elegir };
}
