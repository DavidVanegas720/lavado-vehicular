import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const PAGINAS = [
  { ruta: "/tablero", h1: "Tablero del día" },
  { ruta: "/catalogo", h1: /Cat/ },
  { ruta: "/reportes", h1: /Reportes/ },
  { ruta: "/componentes", h1: "Galería de componentes" },
] as const;

const NAVEGACION = [
  { nombre: "Tablero", ruta: "/tablero" },
  { nombre: "Catálogo", ruta: "/catalogo" },
  { nombre: "Reportes", ruta: "/reportes" },
] as const;

function esMovil(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 768;
}

async function abrirEnlaceDeNavegacion(page: Page, nombre: string): Promise<void> {
  if (esMovil(page)) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const drawer = page.locator("#menu-movil");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: nombre }).click();
    await expect(drawer).toBeHidden();
  } else {
    await page
      .getByRole("navigation", { name: "Principal", exact: true })
      .getByRole("link", { name: nombre })
      .click();
  }
}

test("navega Tablero, Catálogo y Reportes con URL, h1, aria-current y foco", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/tablero$/);
  for (const { nombre, ruta } of NAVEGACION) {
    if (ruta !== "/tablero") await abrirEnlaceDeNavegacion(page, nombre);
    await expect(page).toHaveURL(new RegExp(`${ruta}$`));
    const h1 = page.locator("#contenido h1");
    await expect(h1).toHaveCount(1);
    // En la carga inicial el foco no se mueve (el skip link debe ser el primer Tab).
    if (ruta === "/tablero") await expect(h1).not.toBeFocused();
    else await expect(h1).toBeFocused();
    await expect(page).toHaveTitle(new RegExp(nombre));
    if (!esMovil(page)) {
      const enlace = page
        .getByRole("navigation", { name: "Principal", exact: true })
        .getByRole("link", { name: nombre });
      await expect(enlace).toHaveAttribute("aria-current", "page");
    }
  }
  // El h1 cambió entre páginas.
  await expect(page.locator("#contenido h1")).toContainText("Reportes");
});

test("el tema alterna, persiste al recargar y respeta el sistema sin storage", async ({
  page,
}, info) => {
  await page.goto("/tablero");
  const oscuroAlInicio = info.project.name === "escritorio-oscuro";
  const raiz = page.locator("html");
  if (oscuroAlInicio) await expect(raiz).toHaveClass(/app-oscuro/);
  else await expect(raiz).not.toHaveClass(/app-oscuro/);

  const alternar = page.getByRole("button", { name: /Cambiar a modo/ });
  await alternar.click();
  if (oscuroAlInicio) await expect(raiz).not.toHaveClass(/app-oscuro/);
  else await expect(raiz).toHaveClass(/app-oscuro/);

  await page.reload();
  if (oscuroAlInicio) await expect(raiz).not.toHaveClass(/app-oscuro/);
  else await expect(raiz).toHaveClass(/app-oscuro/);
});

test("el tablero muestra 20 tarjetas de orden", async ({ page }) => {
  await page.goto("/tablero");
  await expect(page.getByRole("article", { name: /^Orden / })).toHaveCount(20);
});

test("la galería renderiza todas sus secciones", async ({ page }) => {
  await page.goto("/componentes");
  const secciones = [
    "Botones",
    "Tarjeta base",
    "Skeleton de carga",
    "Estado vacío",
    "Encabezado de página",
    "Badge de estado",
    "Campos de entrada",
    "Selectores",
    "Formulario base",
    "Tabla base",
    "Tarjeta de orden",
    "Diálogos",
    "Notificaciones",
    "Selector de rango de fechas",
  ];
  for (const nombre of secciones) {
    await expect(page.getByRole("heading", { level: 2, name: nombre, exact: true })).toBeVisible();
  }
});

test("teclado: saltar al contenido y Esc cierra el diálogo", async ({ page }) => {
  await page.goto("/tablero");
  await page.keyboard.press("Tab");
  const saltar = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(saltar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#contenido")).toBeFocused();

  await page.goto("/componentes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Galería de componentes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir diálogo" }).click();
  const dialogo = page.getByRole("dialog", { name: "Diálogo de ejemplo" });
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir diálogo" })).toBeFocused();
});

test("móvil: Esc cierra el menú lateral", async ({ page }) => {
  test.skip(!esMovil(page), "El drawer solo existe en móvil");
  await page.goto("/tablero");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const drawer = page.locator("#menu-movil");
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

for (const { ruta, h1 } of PAGINAS) {
  test(`sin scroll horizontal en ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
    const medidas = await page.evaluate(() => ({
      ancho: document.documentElement.scrollWidth,
      visible: document.documentElement.clientWidth,
    }));
    expect(medidas.ancho).toBeLessThanOrEqual(medidas.visible);
  });
}

test("movimiento reducido anula las transiciones", async ({ page }, info) => {
  test.skip(info.project.name !== "escritorio-movimiento-reducido", "Solo con movimiento reducido");
  await page.goto("/componentes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Galería de componentes" }),
  ).toBeVisible();
  // Se evalúa como texto: el tsconfig de e2e no incluye los tipos del DOM.
  const duraciones = await page.evaluate<{ boton: number; pagina: number }>(`(() => {
    const boton = document.querySelector("#contenido button");
    const sonda = document.createElement("div");
    sonda.className = "pagina-enter-active";
    document.body.append(sonda);
    const de = (el) => (el ? parseFloat(getComputedStyle(el).transitionDuration.split(",")[0]) : NaN);
    const resultado = { boton: de(boton), pagina: de(sonda) };
    sonda.remove();
    return resultado;
  })()`);
  expect(duraciones.boton).toBeLessThan(0.001);
  expect(duraciones.pagina).toBeLessThan(0.001);
});

for (const modo of ["claro", "oscuro"] as const) {
  for (const { ruta, h1 } of PAGINAS) {
    test(`axe sin violaciones serias en ${ruta} (${modo})`, async ({ page }) => {
      await page.addInitScript((m) => {
        try {
          localStorage.setItem("lv.tema", m);
        } catch {
          // sin storage
        }
      }, modo);
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
      // Espera a que termine la carga de datos y las transiciones.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        graves.map((v) => ({
          id: v.id,
          impacto: v.impact,
          nodos: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }
}
