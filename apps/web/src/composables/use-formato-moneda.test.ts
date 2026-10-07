import { describe, expect, it } from "vitest";
import { centavos } from "@lavado-vehicular/shared/dominio/dinero";
import { useFormatoMoneda } from "./use-formato-moneda";

const norm = (s: string): string => s.replace(new RegExp(String.fromCharCode(160), "g"), " ");

describe("useFormatoMoneda", () => {
  const { formatear, formatearSinSimbolo, parsearPesos } = useFormatoMoneda();

  it("formatea pesos enteros sin decimales", () => {
    expect(norm(formatear(centavos(3_000_000)))).toBe("$ 30.000");
    expect(norm(formatear(centavos(0)))).toBe("$ 0");
  });

  it("formatea con 2 decimales si hay centavos", () => {
    expect(norm(formatear(centavos(123_456)))).toBe("$ 1.234,56");
    expect(norm(formatear(centavos(5)))).toBe("$ 0,05");
  });

  it("formatea sin símbolo", () => {
    expect(norm(formatearSinSimbolo(centavos(3_000_000)))).toBe("30.000");
    expect(norm(formatearSinSimbolo(centavos(123_456)))).toBe("1.234,56");
  });

  it("parsea pesos ignorando todo lo que no sea dígito", () => {
    expect(parsearPesos("30.000")).toBe(3_000_000);
    expect(parsearPesos("$ 1a2b")).toBe(1200);
  });

  it("devuelve null si está vacío o fuera de rango", () => {
    expect(parsearPesos("")).toBeNull();
    expect(parsearPesos("abc")).toBeNull();
    expect(parsearPesos("9".repeat(20))).toBeNull();
  });
});
