import { describe, expect, it } from "vitest";
import { centavosDesdePesos } from "@lavado-vehicular/shared/dominio/dinero";
import { ESTADOS_ORDEN, type EstadoOrden } from "@lavado-vehicular/shared/esquemas/ordenes";

describe("paquete shared consumido desde web", () => {
  it("expone esquemas y dominio como fuente TypeScript tipada", () => {
    const estado: EstadoOrden = "CREADA";
    expect(ESTADOS_ORDEN).toContain(estado);
    expect(centavosDesdePesos(30000)).toBe(3_000_000);
  });
});
