import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "./App.vue";
import VistaInicio from "./vistas/VistaInicio.vue";

describe("App", () => {
  it("renderiza el título principal en la ruta raíz", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: VistaInicio }],
    });
    await router.push("/");
    await router.isReady();
    render(App, { global: { plugins: [router] } });
    expect(screen.getByRole("heading", { level: 1, name: "Lavado Vehicular" })).toBeInTheDocument();
  });
});
