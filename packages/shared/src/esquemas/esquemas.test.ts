import { describe, expect, it } from "vitest";
import { esquemaCierreCaja } from "./cierre-caja";
import { esquemaPrecio, esquemaRangoCilindraje, esquemaServicio } from "./catalogo";
import { esquemaNegocio } from "./negocio";
import {
  esquemaEventoOrden,
  esquemaItemOrden,
  esquemaOrden,
  esquemaPago,
} from "./ordenes";
import { esquemaAcuerdoComision, esquemaTrabajador } from "./trabajadores";
import { esquemaUsuarioPublico } from "./usuarios";
import { esquemaVehiculo } from "./vehiculos";
import * as f from "./fixtures";

describe("esquemas: un fixture válido por entidad parsea", () => {
  it.each([
    ["Negocio", esquemaNegocio, f.fixtureNegocio],
    ["UsuarioPublico", esquemaUsuarioPublico, f.fixtureUsuario],
    ["Trabajador", esquemaTrabajador, f.fixtureTrabajador],
    ["AcuerdoComision", esquemaAcuerdoComision, f.fixtureAcuerdo],
    ["RangoCilindraje", esquemaRangoCilindraje, f.fixtureRango],
    ["Servicio", esquemaServicio, f.fixtureServicio],
    ["Precio", esquemaPrecio, f.fixturePrecio],
    ["Vehiculo", esquemaVehiculo, f.fixtureVehiculo],
    ["Orden", esquemaOrden, f.fixtureOrden],
    ["ItemOrden", esquemaItemOrden, f.fixtureItemOrden],
    ["Pago", esquemaPago, f.fixturePago],
    ["EventoOrden", esquemaEventoOrden, f.fixtureEvento],
    ["CierreCaja", esquemaCierreCaja, f.fixtureCierre],
  ] as const)("%s", (_nombre, esquema, fixture) => {
    expect(esquema.safeParse(fixture).success).toBe(true);
  });
});

describe("esquemas: dinero", () => {
  it("rechaza dinero decimal o string", () => {
    expect(esquemaPrecio.safeParse({ ...f.fixturePrecio, precio_centavos: 100.5 }).success).toBe(false);
    expect(esquemaPrecio.safeParse({ ...f.fixturePrecio, precio_centavos: "3000000" }).success).toBe(false);
    expect(esquemaPago.safeParse({ ...f.fixturePago, monto_centavos: 10.5 }).success).toBe(false);
    expect(
      esquemaItemOrden.safeParse({ ...f.fixtureItemOrden, precio_centavos_congelado: "100" }).success,
    ).toBe(false);
  });
});

describe("esquemas: campos extra", () => {
  it("descarta campos desconocidos (strip), p. ej. password_hash", () => {
    const resultado = esquemaUsuarioPublico.parse({ ...f.fixtureUsuario, password_hash: "secreto" });
    expect(resultado).not.toHaveProperty("password_hash");
  });
});

describe("esquemas: reglas del modelo", () => {
  it("cortesía exige motivo", () => {
    expect(
      esquemaOrden.safeParse({ ...f.fixtureOrden, es_cortesia: true, motivo_cortesia: "Cliente frecuente" })
        .success,
    ).toBe(true);
    expect(esquemaOrden.safeParse({ ...f.fixtureOrden, es_cortesia: true }).success).toBe(false);
    expect(
      esquemaOrden.safeParse({ ...f.fixtureOrden, es_cortesia: true, motivo_cortesia: "  " }).success,
    ).toBe(false);
  });

  it("anulada exige motivo de anulación", () => {
    expect(
      esquemaOrden.safeParse({ ...f.fixtureOrden, estado: "ANULADA", motivo_anulacion: "Error de cobro" })
        .success,
    ).toBe(true);
    expect(esquemaOrden.safeParse({ ...f.fixtureOrden, estado: "ANULADA" }).success).toBe(false);
  });

  it("cc_max debe ser nulo o >= cc_min", () => {
    expect(esquemaRangoCilindraje.safeParse({ ...f.fixtureRango, cc_min: 501, cc_max: null }).success).toBe(true);
    expect(esquemaRangoCilindraje.safeParse({ ...f.fixtureRango, cc_min: 201, cc_max: 200 }).success).toBe(false);
  });

  it("diferencia = reportado - esperado", () => {
    expect(esquemaCierreCaja.safeParse(f.fixtureCierre).success).toBe(true);
    expect(esquemaCierreCaja.safeParse({ ...f.fixtureCierre, diferencia_centavos: 50_000 }).success).toBe(false);
  });

  it("el estado y el porcentaje fuera de rango se rechazan", () => {
    expect(esquemaOrden.safeParse({ ...f.fixtureOrden, estado: "PERDIDA" }).success).toBe(false);
    expect(esquemaOrden.safeParse({ ...f.fixtureOrden, porcentaje_comision_congelado: 10001 }).success).toBe(false);
  });

  it("el día operativo debe ser una fecha real", () => {
    expect(esquemaOrden.safeParse({ ...f.fixtureOrden, dia_operativo: "2026-13-01" }).success).toBe(false);
  });
});
