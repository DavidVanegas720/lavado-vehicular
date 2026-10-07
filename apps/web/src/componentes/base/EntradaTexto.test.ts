/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import { cleanup, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it } from "vitest";
import EntradaTexto from "./EntradaTexto.vue";

const global = { plugins: [PrimeVue] };

afterEach(cleanup);

describe("EntradaTexto", () => {
  it("muestra etiqueta, valor y placeholder", () => {
    render(EntradaTexto, {
      props: { etiqueta: "Nombre", modelValue: "Ana", placeholder: "Tu nombre" },
      global,
    });
    const campo = screen.getByLabelText("Nombre");
    expect(campo).toHaveValue("Ana");
    expect(campo).toHaveAttribute("placeholder", "Tu nombre");
  });

  it("emite update:modelValue al escribir y blur al salir", async () => {
    const { emitted } = render(EntradaTexto, {
      props: { etiqueta: "Nombre", modelValue: "" },
      global,
    });
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText("Nombre"), "A");
    await usuario.tab();
    expect(emitted()["update:modelValue"]).toEqual([["A"]]);
    expect(emitted().blur).toHaveLength(1);
  });

  it("expone error, ayuda y requerido por ARIA", () => {
    render(EntradaTexto, {
      props: {
        etiqueta: "Nombre",
        modelValue: "",
        error: "Falta",
        ayuda: "Ayuda",
        requerido: true,
      },
      global,
    });
    const campo = screen.getByLabelText(/Nombre/);
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-required", "true");
    expect(campo).toHaveAccessibleDescription("Ayuda Falta");
  });

  it("sin error no marca aria-invalid", () => {
    render(EntradaTexto, { props: { etiqueta: "Nombre", modelValue: "" }, global });
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid");
  });

  it("deshabilitado no es editable", () => {
    render(EntradaTexto, {
      props: { etiqueta: "Nombre", modelValue: "", deshabilitado: true },
      global,
    });
    expect(screen.getByLabelText("Nombre")).toBeDisabled();
  });

  it("respeta maxlength y autocomplete", () => {
    render(EntradaTexto, {
      props: { etiqueta: "Nombre", modelValue: "", maxlength: 5, autocomplete: "name" },
      global,
    });
    const campo = screen.getByLabelText("Nombre");
    expect(campo).toHaveAttribute("maxlength", "5");
    expect(campo).toHaveAttribute("autocomplete", "name");
  });
});
