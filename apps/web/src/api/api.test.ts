import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reiniciarEstadoMock } from "../mocks/estado";
import { configurarClienteParaPruebas } from "./cliente";
import { listarPrecios, listarRangos, listarServicios } from "./catalogo";
import { obtenerNegocioActual } from "./negocio";
import { listarTableroDelDia } from "./ordenes";
import { listarTrabajadores } from "./trabajadores";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T20:30:00.000Z")); // 15:30 en Bogotá
  reiniciarEstadoMock();
  configurarClienteParaPruebas({ latencia: [0, 0], tasaError: 0, modo: "mock" });
});
afterEach(() => {
  vi.useRealTimers();
  reiniciarEstadoMock();
  configurarClienteParaPruebas();
});

function datos<T>(r: { estado: string; datos?: T }): T {
  expect(r.estado).toBe("ok");
  return r.datos as T;
}

describe("api con mocks", () => {
  it("negocio actual", async () => {
    expect(datos(await obtenerNegocioActual()).nombre).toBe("Medallo Bikes");
  });

  it("catálogo: servicios, rangos y precios del seed", async () => {
    const servicios = datos(await listarServicios());
    const rangos = datos(await listarRangos());
    const precios = datos(await listarPrecios());
    expect(servicios.length).toBeGreaterThan(0);
    expect(rangos.length).toBeGreaterThan(0);
    expect(precios.length).toBeGreaterThan(0);
  });

  it("trabajadores del seed", async () => {
    expect(datos(await listarTrabajadores()).length).toBeGreaterThan(0);
  });

  it("tablero de hoy tiene 20 órdenes ordenadas por created_at", async () => {
    const ordenes = datos(await listarTableroDelDia());
    expect(ordenes).toHaveLength(20);
    const fechas = ordenes.map((o) => o.created_at);
    expect(fechas).toEqual([...fechas].sort());
    expect(ordenes[0]?.placa).toBeTruthy();
  });

  it("día sin órdenes devuelve []", async () => {
    expect(datos(await listarTableroDelDia("2020-01-01"))).toEqual([]);
  });

  it("día mal formado devuelve error de servidor", async () => {
    expect((await listarTableroDelDia("hoy")).estado).toBe("servidor");
  });
});
