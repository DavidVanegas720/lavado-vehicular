/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import SelectorBase from "./SelectorBase.vue";

const opciones = [
  { valor: "a", etiqueta: "Alfa", descripcion: "Primera" },
  { valor: "b", etiqueta: "Beta" },
  { valor: "c", etiqueta: "Gamma", deshabilitada: true },
];
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
}));

const montar = (props: Record<string, unknown> = {}) =>
  render(SelectorBase, {
    props: { etiqueta: "Letra", opciones, modelValue: null, ...props },
    global: { plugins: [PrimeVue] },
  });

afterEach(cleanup);

describe("SelectorBase", () => {
  it("es un combobox asociado a su etiqueta, cerrado al inicio", () => {
    montar();
    const caja = screen.getByRole("combobox", { name: /Letra/ });
    expect(caja).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Seleccionar…")).toBeInTheDocument();
  });

  it("abre por teclado, elige una opción y emite su valor", async () => {
    const { emitted } = montar();
    const usuario = userEvent.setup();
    await usuario.tab();
    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("combobox", { name: /Letra/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("option", { name: /Alfa/ })).toBeInTheDocument();
    await usuario.click(screen.getByRole("option", { name: /Beta/ }));
    expect(emitted()["update:modelValue"]).toEqual([["b"]]);
  });

  it("muestra la descripción de la opción", async () => {
    montar();
    await userEvent.setup().click(screen.getByRole("combobox", { name: /Letra/ }));
    expect(screen.getByText("Primera")).toBeInTheDocument();
  });

  it("marca la opción deshabilitada", async () => {
    montar();
    await userEvent.setup().click(screen.getByRole("combobox", { name: /Letra/ }));
    expect(screen.getByRole("option", { name: /Gamma/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("muestra la etiqueta de la opción seleccionada", () => {
    montar({ modelValue: "b" });
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("filtra solo si se pide o hay más de 7 opciones", async () => {
    montar({ filtrable: true });
    await userEvent.setup().click(screen.getByRole("combobox", { name: /Letra/ }));
    expect(screen.getByPlaceholderText("Buscar…")).toBeInTheDocument();
  });

  it("filtro automático con más de 7 opciones", async () => {
    const muchas = Array.from({ length: 8 }, (_, i) => ({
      valor: `v${String(i)}`,
      etiqueta: `Opción ${String(i)}`,
    }));
    montar({ opciones: muchas });
    await userEvent.setup().click(screen.getByRole("combobox", { name: /Letra/ }));
    expect(screen.getByPlaceholderText("Buscar…")).toBeInTheDocument();
  });

  it("sin filtro con pocas opciones", async () => {
    montar();
    await userEvent.setup().click(screen.getByRole("combobox", { name: /Letra/ }));
    expect(screen.queryByPlaceholderText("Buscar…")).not.toBeInTheDocument();
  });

  it("error, requerido y ayuda por ARIA", () => {
    montar({ error: "Elige una", ayuda: "Obligatorio", requerido: true });
    const caja = screen.getByRole("combobox", { name: /Letra/ });
    expect(caja).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Elige una")).toBeInTheDocument();
    expect(screen.getByText("Obligatorio")).toBeInTheDocument();
  });

  it("cargando no revienta y deshabilitado bloquea", () => {
    montar({ cargando: true, deshabilitado: true });
    expect(screen.getByRole("combobox", { name: /Letra/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
