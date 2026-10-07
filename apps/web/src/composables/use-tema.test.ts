import { beforeEach, describe, expect, it, vi } from "vitest";
import { aplicarTemaInicial, useTema } from "./use-tema";

function simularSistema(oscuro: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: oscuro, addEventListener: vi.fn() }),
  );
  window.matchMedia = globalThis.matchMedia;
}

describe("useTema", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("app-oscuro");
    vi.restoreAllMocks();
    simularSistema(false);
  });

  it("usa el tema oscuro del sistema cuando no hay nada guardado", () => {
    simularSistema(true);
    aplicarTemaInicial();
    expect(useTema().tema.value).toBe("oscuro");
    expect(document.documentElement.classList.contains("app-oscuro")).toBe(true);
  });

  it("usa el tema claro del sistema cuando no hay nada guardado", () => {
    aplicarTemaInicial();
    expect(useTema().tema.value).toBe("claro");
    expect(document.documentElement.classList.contains("app-oscuro")).toBe(false);
  });

  it("prefiere lo guardado en localStorage sobre el sistema", () => {
    simularSistema(true);
    localStorage.setItem("lv.tema", "claro");
    aplicarTemaInicial();
    expect(useTema().tema.value).toBe("claro");
  });

  it("alternar cambia el tema, la clase y lo persiste", () => {
    aplicarTemaInicial();
    const { tema, alternar } = useTema();
    alternar();
    expect(tema.value).toBe("oscuro");
    expect(localStorage.getItem("lv.tema")).toBe("oscuro");
    expect(document.documentElement.classList.contains("app-oscuro")).toBe(true);
    alternar();
    expect(tema.value).toBe("claro");
    expect(localStorage.getItem("lv.tema")).toBe("claro");
  });

  it("establecer fija el tema indicado", () => {
    aplicarTemaInicial();
    useTema().establecer("oscuro");
    expect(useTema().tema.value).toBe("oscuro");
  });

  it("no se rompe si localStorage lanza al leer o escribir", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => {
      aplicarTemaInicial();
    }).not.toThrow();
    expect(() => {
      useTema().alternar();
    }).not.toThrow();
    expect(useTema().tema.value).toBe("oscuro");
  });
});
