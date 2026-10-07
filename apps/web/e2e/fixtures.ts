import { test as base, expect } from "@playwright/test";

/** Hora fija de todas las pruebas: miércoles 7 de octubre de 2026, 15:00 en Bogotá. */
export const HORA_FIJA = new Date("2026-10-07T15:00:00-05:00");

/**
 * `test` que falla ante cualquier `console.error` o `pageerror` durante la prueba
 * y fija el reloj del navegador antes de navegar.
 */
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
      await page.clock.setFixedTime(HORA_FIJA);
      await use(errores);
      expect(errores, "La página no debe producir errores de consola").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
