/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import { cleanup, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it } from "vitest";
import EntradaContrasena from "./EntradaContrasena.vue";

const global = { plugins: [PrimeVue] };

const props = {
  etiqueta: "Contraseña",
  modelValue: "secreto",
  autocomplete: "current-password",
} as const;

afterEach(cleanup);

describe("EntradaContrasena", () => {
  it("arranca oculta con el autocomplete pedido", () => {
    render(EntradaContrasena, { props, global });
    const campo = screen.getByLabelText("Contraseña", { selector: "input" });
    expect(campo).toHaveAttribute("type", "password");
    expect(campo).toHaveAttribute("autocomplete", "current-password");
  });

  it("el botón alterna visibilidad con aria-pressed y aria-label", async () => {
    render(EntradaContrasena, { props: { ...props, autocomplete: "new-password" }, global });
    const boton = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(boton).toHaveAttribute("aria-pressed", "false");
    await userEvent.setup().click(boton);
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Contraseña", { selector: "input" })).toHaveAttribute(
      "type",
      "text",
    );
  });

  it("emite al escribir", async () => {
    const { emitted } = render(EntradaContrasena, { props: { ...props, modelValue: "" }, global });
    await userEvent.setup().type(screen.getByLabelText("Contraseña", { selector: "input" }), "x");
    expect(emitted()["update:modelValue"]).toEqual([["x"]]);
  });

  it("deshabilitada bloquea campo y botón", () => {
    render(EntradaContrasena, { props: { ...props, deshabilitado: true }, global });
    expect(screen.getByLabelText("Contraseña", { selector: "input" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toBeDisabled();
  });
});
