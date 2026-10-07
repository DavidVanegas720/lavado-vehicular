import { expect, test } from "./fixtures";

test("la app arranca y muestra el tablero sin errores de consola", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/tablero$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tablero del día" })).toBeVisible();
});
