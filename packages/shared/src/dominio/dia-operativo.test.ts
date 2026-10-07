import { describe, expect, it } from "vitest";
import {
  calcularDiaOperativo,
  esquemaDiaOperativo,
  type ConfigDiaOperativo,
} from "./dia-operativo";

const bogota: ConfigDiaOperativo = {
  zona_horaria: "America/Bogota",
  hora_apertura: 8,
  hora_cierre: 17,
};

// Bogotá es UTC-5 todo el año.
describe("calcular día operativo", () => {
  it("10:00 Bogotá cae en el mismo día y dentro de horario", () => {
    const r = calcularDiaOperativo(new Date("2026-10-07T15:00:00Z"), bogota);
    expect(r).toEqual({ dia: "2026-10-07", fueraDeHorario: false });
  });

  it("07:00 antes de apertura es el mismo día, fuera de horario", () => {
    const r = calcularDiaOperativo(new Date("2026-10-07T12:00:00Z"), bogota);
    expect(r).toEqual({ dia: "2026-10-07", fueraDeHorario: true });
  });

  it("17:15 después del cierre es el mismo día, fuera de horario", () => {
    const r = calcularDiaOperativo(new Date("2026-10-07T22:15:00Z"), bogota);
    expect(r).toEqual({ dia: "2026-10-07", fueraDeHorario: true });
  });

  it("23:30 Bogotá (04:30Z del día siguiente) usa la fecha de Bogotá, no la UTC", () => {
    const r = calcularDiaOperativo(new Date("2026-10-08T04:30:00Z"), bogota);
    expect(r.dia).toBe("2026-10-07");
    expect(r.fueraDeHorario).toBe(true);
  });

  it("00:00 exacto en Bogotá es el día que empieza", () => {
    const r = calcularDiaOperativo(new Date("2026-10-07T05:00:00Z"), bogota);
    expect(r).toEqual({ dia: "2026-10-07", fueraDeHorario: true });
  });

  it("la hora exacta de apertura está dentro de horario y la de cierre fuera", () => {
    expect(calcularDiaOperativo(new Date("2026-10-07T13:00:00Z"), bogota).fueraDeHorario).toBe(
      false,
    );
    expect(calcularDiaOperativo(new Date("2026-10-07T22:00:00Z"), bogota).fueraDeHorario).toBe(
      true,
    );
  });

  it("lanza con zona horaria inválida", () => {
    expect(() =>
      calcularDiaOperativo(new Date(), { ...bogota, zona_horaria: "Marte/Olimpo" }),
    ).toThrow(/Zona horaria inválida/);
  });

  it("lanza si apertura >= cierre", () => {
    expect(() => calcularDiaOperativo(new Date(), { ...bogota, hora_apertura: 17 })).toThrow(
      /Horario inválido/,
    );
  });

  it("lanza si el cierre supera 24", () => {
    expect(() => calcularDiaOperativo(new Date(), { ...bogota, hora_cierre: 25 })).toThrow(
      /Horario inválido/,
    );
  });
});

describe("esquema de día operativo", () => {
  it("acepta una fecha real y rechaza una inexistente o mal formada", () => {
    expect(esquemaDiaOperativo.safeParse("2026-02-28").success).toBe(true);
    expect(esquemaDiaOperativo.safeParse("2026-02-30").success).toBe(false);
    expect(esquemaDiaOperativo.safeParse("07/10/2026").success).toBe(false);
  });
});
