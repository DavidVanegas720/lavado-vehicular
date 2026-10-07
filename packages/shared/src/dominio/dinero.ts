import { z } from "zod";

// Todo el dinero del sistema es un entero en centavos (regla 1). Un peso son 100 centavos.

/** Entero seguro >= 0, marcado para que el compilador impida mezclar pesos con centavos. */
export const esquemaCentavos = z
  .number({ error: "El monto debe ser un número" })
  .int({ error: "El monto debe ser un entero en centavos" })
  .refine((n) => Number.isSafeInteger(n), { error: "El monto está fuera del rango permitido" })
  .min(0, { error: "El monto no puede ser negativo" })
  .brand<"Centavos">();

/** Entero seguro, con signo (por ejemplo `diferencia_centavos` del cierre de caja). */
export const esquemaCentavosConSigno = z
  .number({ error: "El monto debe ser un número" })
  .int({ error: "El monto debe ser un entero en centavos" })
  .refine((n) => Number.isSafeInteger(n), { error: "El monto está fuera del rango permitido" })
  .brand<"CentavosConSigno">();

export type Centavos = z.infer<typeof esquemaCentavos>;
export type CentavosConSigno = z.infer<typeof esquemaCentavosConSigno>;

/** Convierte un número a `Centavos`; lanza si no es un entero seguro >= 0. */
export function centavos(n: number): Centavos {
  const resultado = esquemaCentavos.safeParse(n);
  if (!resultado.success) {
    throw new Error(`Monto en centavos inválido: ${String(n)}. Debe ser un entero seguro >= 0.`);
  }
  return resultado.data;
}

/** Convierte pesos enteros a centavos (`30000` pesos => `3_000_000` centavos). */
export function centavosDesdePesos(pesos: number): Centavos {
  if (!Number.isSafeInteger(pesos)) {
    throw new Error(`Monto en pesos inválido: ${String(pesos)}. Debe ser un número entero.`);
  }
  return centavos(pesos * 100);
}

/** Suma una lista de montos en centavos. La lista vacía suma 0. */
export function sumarCentavos(lista: readonly Centavos[]): Centavos {
  let total = 0;
  for (const monto of lista) total += monto;
  return centavos(total);
}
