import { cleanup, render, screen, waitFor } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "./App.vue";
import { instalarGanchosNavegacion, rutas } from "./router";

async function montar(ruta: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: rutas });
  instalarGanchosNavegacion(router);
  await router.push(ruta);
  await router.isReady();
  const utilidades = render(App, { global: { plugins: [router, PrimeVue] } });
  return { router, ...utilidades };
}

describe("App", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("app-oscuro");
  });

  it("la raíz redirige al tablero y marca aria-current", async () => {
    const { router } = await montar("/");
    expect(router.currentRoute.value.path).toBe("/tablero");
    expect(await screen.findByRole("heading", { level: 1, name: "Tablero" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav.querySelector("[aria-current='page']")).toHaveTextContent("Tablero");
    expect(document.title).toBe("Tablero · Lavado Vehicular");
  });

  it("navegar cambia el ítem activo", async () => {
    const { router } = await montar("/tablero");
    await router.push("/catalogo");
    const nav = screen.getByRole("navigation", { name: "Principal" });
    await waitFor(() =>
      expect(nav.querySelector("[aria-current='page']")).toHaveTextContent("Catálogo"),
    );
  });

  it("ruta desconocida muestra el 404", async () => {
    await montar("/no-existe");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Página no encontrada" }),
    ).toBeInTheDocument();
  });

  it("el botón de menú alterna aria-expanded", async () => {
    await montar("/tablero");
    const boton = screen.getByRole("button", { name: "Abrir menú" });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "false");
  });

  it("BotonTema alterna la clase en <html> y aria-pressed", async () => {
    await montar("/tablero");
    const boton = screen.getByRole("button", { name: "Cambiar a modo oscuro" });
    expect(boton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(boton);
    expect(document.documentElement.classList.contains("app-oscuro")).toBe(true);
    const volver = screen.getByRole("button", { name: "Cambiar a modo claro" });
    expect(volver).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(volver);
    expect(document.documentElement.classList.contains("app-oscuro")).toBe(false);
  });

  it("el enlace de salto enfoca el contenido principal", async () => {
    await montar("/tablero");
    await userEvent.click(screen.getByText("Saltar al contenido"));
    expect(document.getElementById("contenido")).toHaveFocus();
  });
});
