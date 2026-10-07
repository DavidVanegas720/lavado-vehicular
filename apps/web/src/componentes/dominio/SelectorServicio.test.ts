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

import { esquemaServicio } from "@lavado-vehicular/shared/esquemas/catalogo";
import { fixtureServicio } from "@lavado-vehicular/shared/esquemas/fixtures";
import SelectorServicio from "./SelectorServicio.vue";

const servicio = (id: string, nombre: string, extra: Record<string, unknown> = {}) =>
  esquemaServicio.parse({ ...fixtureServicio, id, nombre, ...extra });

const servicios = [
  servicio("s1", "Servicio Básico", { tipo: "PAQUETE" }),
  servicio("s2", "Brillado de farola", { tipo: "ADICIONAL" }),
  servicio("s3", "Servicio Viejo", { tipo: "PAQUETE", activo: false }),
];

async function abrir(props: Record<string, unknown> = {}) {
  const vista = render(SelectorServicio, {
    props: { etiqueta: "Servicio", modelValue: null, servicios, ...props },
    global: { plugins: [PrimeVue] },
  });
  await userEvent.setup().click(screen.getByRole("combobox", { name: /Servicio/ }));
  return vista;
}
const nombres = () => screen.queryAllByRole("option").map((o) => o.getAttribute("aria-label"));

describe("SelectorServicio", () => {
  it("por defecto oculta los inactivos", async () => {
    await abrir();
    expect(nombres()).toEqual(["Servicio Básico", "Brillado de farola"]);
  });

  it("filtra por tipo", async () => {
    await abrir({ tipo: "ADICIONAL" });
    expect(nombres()).toEqual(["Brillado de farola"]);
  });

  it("incluye inactivos si se pide, marcados", async () => {
    await abrir({ incluirInactivos: true });
    expect(nombres()).toContain("Servicio Viejo (inactivo)");
  });

  it("emite el id del servicio elegido", async () => {
    const { emitted } = await abrir();
    await userEvent.setup().click(screen.getByRole("option", { name: "Brillado de farola" }));
    expect(emitted()["update:modelValue"]).toEqual([["s2"]]);
  });

  it("conserva visible un servicio inactivo ya seleccionado", async () => {
    await abrir({ modelValue: "s3" });
    expect(nombres()).toContain("Servicio Viejo (inactivo)");
  });
});
