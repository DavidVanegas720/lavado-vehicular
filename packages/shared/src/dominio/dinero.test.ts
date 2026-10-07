import { describe, expect, it } from "vitest";
import {
  centavos,
  centavosDesdePesos,
  esquemaCentavos,
  esquemaCentavosConSigno,
  sumarCentavos,
} from "./dinero";

describe("dinero en centavos", () => {
  it("acepta enteros no negativos", () => {
    expect(centavos(0)).toBe(0);
    expect(centavos(3_000_000)).toBe(3_000_000);
  });

  it.each([0.5, Number.NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])("rechaza %s", (valor) => {
    expect(() => centavos(valor)).toThrow(/inválido/);
  });

  it("rechaza texto en el esquema", () => {
    expect(esquemaCentavos.safeParse("30000").success).toBe(false);
  });

  it("el esquema con signo acepta negativos enteros y rechaza decimales", () => {
    expect(esquemaCentavosConSigno.safeParse(-500).success).toBe(true);
    expect(esquemaCentavosConSigno.safeParse(-0.5).success).toBe(false);
  });

  it("convierte pesos enteros a centavos", () => {
    expect(centavosDesdePesos(30000)).toBe(3_000_000);
  });

  it("rechaza pesos con decimales", () => {
    expect(() => centavosDesdePesos(300.5)).toThrow(/entero/);
  });

  it("suma centavos", () => {
    expect(sumarCentavos([centavos(100), centavos(250)])).toBe(350);
    expect(sumarCentavos([])).toBe(0);
  });
});
