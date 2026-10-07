import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { iniciarObservabilidad } from "./sentry";

function crearRouter() {
  return createRouter({ history: createMemoryHistory(), routes: [] });
}

describe("observabilidad en modo consola", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sin DSN, un error de componente llega a console.error", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp(() => {
      throw new Error("fallo de prueba");
    });
    iniciarObservabilidad(app, crearRouter(), undefined);
    app.mount(document.createElement("div"));

    expect(consola).toHaveBeenCalledWith(
      "[observabilidad]",
      "error de componente",
      expect.any(String),
      expect.objectContaining({ message: "fallo de prueba" }),
    );
  });

  it("sin DSN, una promesa rechazada llega a console.error", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp(() => h("div"));
    iniciarObservabilidad(app, crearRouter(), undefined);
    const evento = new Event("unhandledrejection");
    Object.assign(evento, { reason: new Error("rechazo") });
    window.dispatchEvent(evento);
    expect(consola).toHaveBeenCalledWith(
      "[observabilidad]",
      "promesa rechazada sin manejar",
      expect.any(Error),
    );
  });
});
