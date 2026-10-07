/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
}));
afterEach(cleanup);

import { esquemaRangoCilindraje } from "@lavado-vehicular/shared/esquemas/catalogo";
import { fixtureRango } from "@lavado-vehicular/shared/esquemas/fixtures";
import SelectorRango from "./SelectorRango.vue";

const rango = (id: string, nombre: string, extra: Record<string, unknown>) =>
  esquemaRangoCilindraje.parse({ ...fixtureRango, id, nombre, ...extra });

const rangos = [
  rango("r3", "501cc en adelante", { cc_min: 501, cc_max: null, orden_visualizacion: 3 }),
  rango("r1", "Hasta 200cc", { cc_min: 0, cc_max: 200, orden_visualizacion: 1 }),
  rango("r2", "201-500cc", { cc_min: 201, cc_max: 500, orden_visualizacion: 2 }),
  rango("rx", "Retirado", { cc_min: 0, cc_max: 50, orden_visualizacion: 0, activo: false }),
];

async function abrir(props: Record<string, unknown> = {}) {
  const vista = render(SelectorRango, {
    props: { etiqueta: "Cilindraje", modelValue: null, rangos, ...props },
    global: { plugins: [PrimeVue] },
  });
  await userEvent.setup().click(screen.getByRole("combobox", { name: /Cilindraje/ }));
  return vista;
}

describe("SelectorRango", () => {
  it("ordena por orden_visualizacion y omite inactivos", async () => {
    await abrir();
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("aria-label"))).toEqual([
      "Hasta 200cc",
      "201-500cc",
      "501cc en adelante",
    ]);
  });

  it("describe el intervalo de cc", async () => {
    await abrir();
    expect(screen.getByText("0 a 200 cc")).toBeInTheDocument();
    expect(screen.getByText("Desde 501 cc")).toBeInTheDocument();
  });

  it("emite el id elegido", async () => {
    const { emitted } = await abrir();
    await userEvent.setup().click(screen.getByRole("option", { name: "201-500cc" }));
    expect(emitted()["update:modelValue"]).toEqual([["r2"]]);
  });

  it("muestra error accesible", () => {
    render(SelectorRango, {
      props: { etiqueta: "Cilindraje", modelValue: null, rangos, error: "Elige un rango" },
      global: { plugins: [PrimeVue] },
    });
    expect(screen.getByRole("combobox", { name: /Cilindraje/ })).toHaveAccessibleDescription(
      "Elige un rango",
    );
  });
});
