/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
}));
afterEach(cleanup);

import SelectorMetodoPago from "./SelectorMetodoPago.vue";

const montar = (props: Record<string, unknown> = {}) =>
  render(SelectorMetodoPago, { props: { etiqueta: "Método de pago", modelValue: null, ...props } });

describe("SelectorMetodoPago", () => {
  it("es un radiogroup con etiqueta y tres opciones", () => {
    montar();
    const grupo = screen.getByRole("radiogroup", { name: /Método de pago/ });
    expect(grupo).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent.trim())).toEqual([
      "Efectivo",
      "QR",
      "Otro",
    ]);
  });

  it("marca aria-checked solo en el seleccionado", () => {
    montar({ modelValue: "QR" });
    expect(screen.getByRole("radio", { name: "QR" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Efectivo" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("clic emite el método", async () => {
    const { emitted } = montar();
    await userEvent.setup().click(screen.getByRole("radio", { name: "Otro" }));
    expect(emitted()["update:modelValue"]).toEqual([["OTRO"]]);
  });

  it("las flechas mueven la selección con vuelta circular", async () => {
    const { emitted } = montar({ modelValue: "EFECTIVO" });
    const usuario = userEvent.setup();
    screen.getByRole("radio", { name: "Efectivo" }).focus();
    await usuario.keyboard("{ArrowRight}{ArrowLeft}{ArrowLeft}");
    expect(emitted()["update:modelValue"]).toEqual([["QR"], ["EFECTIVO"], ["OTRO"]]);
  });

  it("solo el seleccionado es tabulable (o el primero sin selección)", () => {
    montar({ modelValue: "QR" });
    expect(screen.getByRole("radio", { name: "QR" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Efectivo" })).toHaveAttribute("tabindex", "-1");
    cleanup();
    montar();
    expect(screen.getByRole("radio", { name: "Efectivo" })).toHaveAttribute("tabindex", "0");
  });

  it("deshabilitado no emite", async () => {
    const { emitted } = montar({ deshabilitado: true });
    await userEvent.setup().click(screen.getByRole("radio", { name: "QR" }));
    expect(emitted()["update:modelValue"]).toBeUndefined();
  });

  it("muestra el error y lo enlaza al grupo", () => {
    montar({ error: "Elige un método" });
    const grupo = screen.getByRole("radiogroup");
    expect(grupo).toHaveAttribute("aria-invalid", "true");
    expect(grupo).toHaveAccessibleDescription("Elige un método");
  });
});
