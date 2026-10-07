import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import type { DiaOperativo } from "@lavado-vehicular/shared/dominio/dia-operativo";
import { describe, expect, it } from "vitest";
import SelectorRangoFechas from "./SelectorRangoFechas.vue";

const dia = (texto: string): DiaOperativo => texto as DiaOperativo;

// 2026-10-07 es miércoles; la semana lunes–domingo empieza el 2026-10-05 (H-08).
const base = { etiqueta: "Periodo", modelValue: null, maximo: dia("2026-10-07") };

describe("SelectorRangoFechas", () => {
  it("expone grupo etiquetado con Desde y Hasta", () => {
    render(SelectorRangoFechas, { props: base });
    expect(screen.getByRole("group", { name: /Periodo/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Desde")).toHaveAttribute("max", "2026-10-07");
    expect(screen.getByLabelText("Hasta")).toBeInTheDocument();
  });

  it.each([
    ["Hoy", "2026-10-07", "2026-10-07"],
    ["Esta semana", "2026-10-05", "2026-10-07"],
    ["Este mes", "2026-10-01", "2026-10-07"],
    ["Mes anterior", "2026-09-01", "2026-09-30"],
  ])("atajo %s emite el rango", async (nombre, desde, hasta) => {
    const vista = render(SelectorRangoFechas, { props: base });
    await userEvent.setup().click(screen.getByRole("button", { name: nombre }));
    expect(vista.emitted()["update:modelValue"]).toEqual([
      [{ desde: dia(desde), hasta: dia(hasta) }],
    ]);
  });

  it("oculta atajos si atajos=false", () => {
    render(SelectorRangoFechas, { props: { ...base, atajos: false } });
    expect(screen.queryByRole("button", { name: "Hoy" })).not.toBeInTheDocument();
  });

  it("mantiene desde <= hasta y respeta el máximo", async () => {
    const vista = render(SelectorRangoFechas, {
      props: { ...base, modelValue: { desde: dia("2026-10-01"), hasta: dia("2026-10-03") } },
    });
    await fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-05" } });
    const ultimo = vista.emitted()["update:modelValue"]?.at(-1);
    expect(ultimo).toEqual([{ desde: "2026-10-05", hasta: "2026-10-05" }]);
  });

  it("muestra el valor recibido y el error accesible", () => {
    render(SelectorRangoFechas, {
      props: {
        ...base,
        modelValue: { desde: dia("2026-10-01"), hasta: dia("2026-10-03") },
        error: "Elige un periodo",
      },
    });
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-10-03");
    expect(screen.getByRole("group", { name: /Periodo/ })).toHaveAccessibleDescription(
      "Elige un periodo",
    );
  });
});
