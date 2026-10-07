import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import type { ConfigDiaOperativo } from "@lavado-vehicular/shared/dominio/dia-operativo";
import { useDiaOperativo } from "./use-dia-operativo";

const config: ConfigDiaOperativo = {
  zona_horaria: "America/Bogota",
  hora_apertura: 7,
  hora_cierre: 19,
};

describe("useDiaOperativo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calcula el día y el horario con la función de shared", () => {
    vi.setSystemTime(new Date("2026-10-07T15:00:00-05:00"));
    const scope = effectScope();
    const r = scope.run(() => useDiaOperativo(config));
    expect(r?.diaActual.value).toBe("2026-10-07");
    expect(r?.fueraDeHorario.value).toBe(false);
    scope.stop();
  });

  it("23:30 Bogotá sigue siendo el mismo día, fuera de horario", () => {
    vi.setSystemTime(new Date("2026-10-07T23:30:00-05:00"));
    const scope = effectScope();
    const r = scope.run(() => useDiaOperativo(config));
    expect(r?.diaActual.value).toBe("2026-10-07");
    expect(r?.fueraDeHorario.value).toBe(true);
    scope.stop();
  });

  it("se actualiza cada 60 s y limpia el intervalo al destruir el scope", () => {
    vi.setSystemTime(new Date("2026-10-07T18:59:30-05:00"));
    const scope = effectScope();
    const r = scope.run(() => useDiaOperativo(config));
    expect(r?.fueraDeHorario.value).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(r?.fueraDeHorario.value).toBe(true);
    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("formatea día y hora en la zona del negocio", () => {
    vi.setSystemTime(new Date("2026-10-07T15:00:00-05:00"));
    const scope = effectScope();
    const r = scope.run(() => useDiaOperativo(config));
    expect(r?.formatearDia("2026-10-07")).toBe("miércoles, 7 de octubre de 2026");
    expect(r?.formatearHora("2026-10-07T20:05:00Z")).toBe("15:05");
    scope.stop();
  });
});
