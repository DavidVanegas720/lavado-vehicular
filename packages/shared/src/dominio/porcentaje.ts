import { z } from "zod";

/** Porcentaje en base 10000: `5000` = 50,00 %. Entero entre 0 y 10000. */
export const esquemaPorcentajeBase10000 = z
  .number({ error: "El porcentaje debe ser un número" })
  .int({ error: "El porcentaje debe ser un entero (base 10000)" })
  .min(0, { error: "El porcentaje no puede ser negativo" })
  .max(10000, { error: "El porcentaje no puede superar 10000 (100,00 %)" });

export type PorcentajeBase10000 = z.infer<typeof esquemaPorcentajeBase10000>;
