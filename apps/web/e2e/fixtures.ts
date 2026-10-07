import { test as base, expect } from "@playwright/test";

/** `test` que falla ante cualquier `console.error` o `pageerror` durante la prueba. */
export const test = base.extend<{ erroresDeConsola: string[] }>({
  erroresDeConsola: [
    async ({ page }, use) => {
      const errores: string[] = [];
      page.on("console", (mensaje) => {
        if (mensaje.type() === "error") errores.push(`console.error: ${mensaje.text()}`);
      });
      page.on("pageerror", (error) => {
        errores.push(`pageerror: ${error.message}`);
      });
      await use(errores);
      expect(errores, "La página no debe producir errores de consola").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
