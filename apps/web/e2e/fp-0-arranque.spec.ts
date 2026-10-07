import { expect, test } from "./fixtures";

test("la app arranca y muestra el título sin errores de consola", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Lavado Vehicular" })).toBeVisible();
});
