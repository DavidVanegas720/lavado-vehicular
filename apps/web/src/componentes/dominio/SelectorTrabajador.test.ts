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

import { esquemaTrabajador } from "@lavado-vehicular/shared/esquemas/trabajadores";
import { fixtureTrabajador } from "@lavado-vehicular/shared/esquemas/fixtures";
import SelectorTrabajador from "./SelectorTrabajador.vue";

const trabajador = (id: string, nombre: string, activo = true) =>
  esquemaTrabajador.parse({ ...fixtureTrabajador, id, nombre, activo });

const trabajadores = [
  trabajador("t1", "Ana"),
  trabajador("t2", "Luis"),
  trabajador("t3", "Pedro", false),
];

async function abrir(props: Record<string, unknown> = {}) {
  const vista = render(SelectorTrabajador, {
    props: { etiqueta: "Trabajador", modelValue: null, trabajadores, ...props },
    global: { plugins: [PrimeVue] },
  });
  await userEvent.setup().click(screen.getByRole("combobox", { name: /Trabajador/ }));
  return vista;
}
const nombres = () => screen.queryAllByRole("option").map((o) => o.getAttribute("aria-label"));

describe("SelectorTrabajador", () => {
  it("lista solo activos por defecto, sin 'Sin asignar'", async () => {
    await abrir();
    expect(nombres()).toEqual(["Ana", "Luis"]);
  });

  it("incluye inactivos si se pide", async () => {
    await abrir({ incluirInactivos: true });
    expect(nombres()).toEqual(["Ana", "Luis", "Pedro (inactivo)"]);
  });

  it("ofrece 'Sin asignar' solo si se pide y emite null", async () => {
    const { emitted } = await abrir({ permiteSinAsignar: true, modelValue: "t1" });
    expect(nombres()[0]).toBe("Sin asignar");
    await userEvent.setup().click(screen.getByRole("option", { name: "Sin asignar" }));
    expect(emitted()["update:modelValue"]).toEqual([[null]]);
  });

  it("con permiteSinAsignar y modelValue null muestra 'Sin asignar'", () => {
    render(SelectorTrabajador, {
      props: { etiqueta: "Trabajador", modelValue: null, trabajadores, permiteSinAsignar: true },
      global: { plugins: [PrimeVue] },
    });
    expect(screen.getByRole("combobox", { name: /Trabajador/ })).toHaveTextContent("Sin asignar");
  });

  it("emite el id del trabajador elegido", async () => {
    const { emitted } = await abrir();
    await userEvent.setup().click(screen.getByRole("option", { name: "Luis" }));
    expect(emitted()["update:modelValue"]).toEqual([["t2"]]);
  });
});
