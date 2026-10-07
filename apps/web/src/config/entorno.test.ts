import { describe, expect, it } from "vitest";
import { leerEntorno } from "./entorno";

describe("leer entorno", () => {
  it("usa valores por defecto con un entorno vacío", () => {
    const e = leerEntorno({});
    expect(e.sentryDsn).toBeUndefined();
    expect(e.mockErrorRate).toBe(0);
    expect(e.mockLatenciaMinMs).toBe(100);
    expect(e.modoApi.ordenes).toBe("mock");
  });

  it("convierte textos a números y trata el DSN vacío como ausente", () => {
    const e = leerEntorno({
      VITE_SENTRY_DSN: "  ",
      VITE_MOCK_ERROR_RATE: "0.05",
      VITE_API_MODO_AUTH: "http",
    });
    expect(e.sentryDsn).toBeUndefined();
    expect(e.mockErrorRate).toBe(0.05);
    expect(e.modoApi.auth).toBe("http");
  });

  it("lanza un error en español si el modo es inválido", () => {
    expect(() => leerEntorno({ VITE_API_MODO_AUTH: "nube" })).toThrow(
      /Configuración de entorno inválida/,
    );
  });

  it("lanza si la tasa de error sale de 0..1", () => {
    expect(() => leerEntorno({ VITE_MOCK_ERROR_RATE: "2" })).toThrow(/VITE_MOCK_ERROR_RATE/);
  });

  it("lanza si la latencia no es entera o min > max", () => {
    expect(() => leerEntorno({ VITE_MOCK_LATENCIA_MIN_MS: "1.5" })).toThrow(
      /VITE_MOCK_LATENCIA_MIN_MS/,
    );
    expect(() =>
      leerEntorno({ VITE_MOCK_LATENCIA_MIN_MS: "500", VITE_MOCK_LATENCIA_MAX_MS: "100" }),
    ).toThrow(/mínima/);
  });
});
