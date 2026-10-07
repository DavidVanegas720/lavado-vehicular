import { describe, expect, it } from "vitest";
import { calcularDiaOperativo } from "@lavado-vehicular/shared/dominio/dia-operativo";
import { esquemaResumenOrdenTablero } from "@lavado-vehicular/shared/esquemas/ordenes";
import { obtenerEstado, reiniciarEstadoMock } from "./estado";
import { crearSeed } from "./seed";

const AHORA = new Date("2026-10-07T20:30:00.000Z"); // 15:30 en Bogotá
const CONFIG = { zona_horaria: "America/Bogota", hora_apertura: 8, hora_cierre: 17 };

function sumaPagos(estado: ReturnType<typeof crearSeed>, ordenId: string): number {
  return estado.pagos
    .filter((p) => p.orden_id === ordenId)
    .reduce((a, p) => a + p.monto_centavos, 0);
}
function sumaItems(estado: ReturnType<typeof crearSeed>, ordenId: string): number {
  return estado.items
    .filter((i) => i.orden_id === ordenId)
    .reduce((a, i) => a + i.precio_centavos_congelado, 0);
}

describe("crearSeed", () => {
  const estado = crearSeed(AHORA);

  it("es determinista: el mismo ahora produce el mismo resultado", () => {
    expect(crearSeed(AHORA)).toEqual(crearSeed(AHORA));
  });

  it("tiene 20 órdenes con la distribución pedida y todas con trabajador", () => {
    const cuantas = (e: string): number => estado.ordenes.filter((o) => o.estado === e).length;
    expect(estado.ordenes).toHaveLength(20);
    expect(cuantas("CREADA")).toBe(4);
    expect(cuantas("LAVANDO")).toBe(4);
    expect(cuantas("LISTA")).toBe(3);
    expect(cuantas("COBRADA")).toBe(3);
    expect(cuantas("ENTREGADA")).toBe(4);
    expect(cuantas("ANULADA")).toBe(2);
    expect(estado.ordenes.every((o) => o.trabajador_id !== null)).toBe(true);
    expect(estado.vehiculos).toHaveLength(18);
  });

  it("todo el dinero es entero", () => {
    const montos = [
      ...estado.pagos.map((p) => p.monto_centavos),
      ...estado.items.map((i) => i.precio_centavos_congelado),
      ...estado.precios.map((p) => p.precio_centavos),
    ];
    expect(montos.every((m) => Number.isInteger(m))).toBe(true);
  });

  it("el día operativo coincide con la función única", () => {
    for (const orden of estado.ordenes) {
      expect(orden.dia_operativo).toBe(
        calcularDiaOperativo(new Date(orden.created_at), CONFIG).dia,
      );
    }
    for (const pago of estado.pagos) {
      expect(pago.dia_operativo).toBe(calcularDiaOperativo(new Date(pago.created_at), CONFIG).dia);
    }
  });

  it("COBRADA/ENTREGADA no cortesía: pagos >= ítems; excedente lleva concepto", () => {
    const cobradas = estado.ordenes.filter(
      (o) => (o.estado === "COBRADA" || o.estado === "ENTREGADA") && !o.es_cortesia,
    );
    expect(cobradas).toHaveLength(6);
    for (const orden of cobradas) {
      const pagado = sumaPagos(estado, orden.id);
      const items = sumaItems(estado, orden.id);
      expect(pagado).toBeGreaterThanOrEqual(items);
      if (pagado > items) {
        expect(estado.pagos.some((p) => p.orden_id === orden.id && p.concepto === "propina")).toBe(
          true,
        );
      }
    }
    const partidos = cobradas.filter(
      (o) =>
        new Set(estado.pagos.filter((p) => p.orden_id === o.id).map((p) => p.metodo)).size === 2,
    );
    expect(partidos).toHaveLength(1);
  });

  it("la cortesía no tiene pagos y exige motivo", () => {
    const cortesias = estado.ordenes.filter((o) => o.es_cortesia);
    expect(cortesias).toHaveLength(1);
    expect(cortesias[0]?.estado).toBe("ENTREGADA");
    expect(cortesias[0]?.motivo_cortesia).toBeTruthy();
    expect(sumaPagos(estado, cortesias[0]?.id ?? "")).toBe(0);
  });

  it("las anuladas tienen motivo, una cobrada conserva su pago y tiene reemplazo", () => {
    const anuladas = estado.ordenes.filter((o) => o.estado === "ANULADA");
    expect(anuladas.every((o) => (o.motivo_anulacion ?? "") !== "")).toBe(true);
    const cobrada = anuladas.find((o) => o.fecha_cobro !== null);
    expect(cobrada).toBeDefined();
    expect(sumaPagos(estado, cobrada?.id ?? "")).toBeGreaterThan(0);
    expect(estado.ordenes.some((o) => o.orden_reemplaza_id === cobrada?.id)).toBe(true);
  });

  it("el % congelado es el acuerdo vigente del trabajador", () => {
    for (const orden of estado.ordenes) {
      const vigente = estado.acuerdos.find(
        (a) => a.trabajador_id === orden.trabajador_id && a.fecha_fin === null,
      );
      expect(orden.porcentaje_comision_congelado).toBe(vigente?.porcentaje_base);
    }
    const historial = estado.acuerdos.filter((a) => a.trabajador_id === estado.trabajadores[1]?.id);
    expect(historial.map((a) => a.porcentaje_base)).toEqual([4000, 4500]);
  });

  it("los ids son únicos", () => {
    const ids = [
      ...estado.usuarios,
      ...estado.trabajadores,
      ...estado.acuerdos,
      ...estado.rangos,
      ...estado.servicios,
      ...estado.precios,
      ...estado.vehiculos,
      ...estado.ordenes,
      ...estado.items,
      ...estado.pagos,
      ...estado.eventos,
    ].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("las fechas de cada orden son monotónicas y nunca futuras", () => {
    for (const o of estado.ordenes) {
      const fechas = [
        o.created_at,
        o.fecha_asignacion,
        o.fecha_lavando,
        o.fecha_lista,
        o.fecha_cobro,
        o.fecha_entrega,
        o.fecha_anulacion,
      ]
        .filter((f): f is string => f !== null)
        .map((f) => Date.parse(f));
      expect([...fechas].sort((a, b) => a - b)).toEqual(fechas);
      expect(Math.max(...fechas)).toBeLessThanOrEqual(AHORA.getTime());
    }
  });

  it("hay un evento por cada transición registrada", () => {
    for (const o of estado.ordenes) {
      const tipos = estado.eventos.filter((e) => e.orden_id === o.id).map((e) => e.tipo);
      expect(tipos).toContain("CREADA");
      expect(tipos.includes("COBRADA")).toBe(o.fecha_cobro !== null);
      expect(tipos.includes("ENTREGADA")).toBe(o.fecha_entrega !== null);
      expect(tipos.includes("ANULADA")).toBe(o.fecha_anulacion !== null);
    }
  });

  it("no cruza de día a las 00:05 ni a las 23:50 de Bogotá", () => {
    for (const hora of ["2026-10-07T05:05:00.000Z", "2026-10-08T04:50:00.000Z"]) {
      const ahora = new Date(hora);
      const dia = calcularDiaOperativo(ahora, CONFIG).dia;
      const s = crearSeed(ahora);
      expect(s.ordenes.every((o) => o.dia_operativo === dia)).toBe(true);
      expect(s.ordenes.every((o) => Date.parse(o.created_at) <= ahora.getTime())).toBe(true);
    }
  });

  it("el DTO del tablero acepta una orden con sus ítems", () => {
    const orden = estado.ordenes[0];
    if (!orden) throw new Error("sin órdenes");
    const resumen = {
      ...orden,
      placa: "ABC12D",
      cilindraje: 150,
      trabajador_nombre: "Juan Pérez",
      items: estado.items.filter((i) => i.orden_id === orden.id),
      total_centavos: sumaItems(estado, orden.id),
    };
    expect(esquemaResumenOrdenTablero.safeParse(resumen).success).toBe(true);
  });
});

describe("estado en memoria", () => {
  it("crea el seed perezosamente y se puede reiniciar", () => {
    reiniciarEstadoMock();
    const primero = obtenerEstado();
    expect(obtenerEstado()).toBe(primero);
    reiniciarEstadoMock();
    expect(obtenerEstado()).not.toBe(primero);
  });
});
