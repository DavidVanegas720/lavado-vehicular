/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it } from "vitest";
import EntradaNumero from "./EntradaNumero.vue";

const global = { plugins: [PrimeVue] };

const base = { etiqueta: "Cilindraje", modelValue: null };

afterEach(cleanup);

describe("EntradaNumero", () => {
  it("usa inputmode numérico y muestra el valor", () => {
    render(EntradaNumero, { props: { ...base, modelValue: 150 }, global });
    const campo = screen.getByLabelText("Cilindraje");
    expect(campo).toHaveAttribute("inputmode", "numeric");
    expect(campo).toHaveValue("150");
  });

  it("rechaza decimales y letras: solo enteros", async () => {
    const { emitted } = render(EntradaNumero, { props: base, global });
    const campo = screen.getByLabelText("Cilindraje");
    await fireEvent.update(campo, "12.5");
    await fireEvent.update(campo, "1a2,3");
    expect(emitted()["update:modelValue"]).toEqual([[125], [123]]);
  });

  it("vacío emite null", async () => {
    const { emitted } = render(EntradaNumero, { props: { ...base, modelValue: 5 }, global });
    await fireEvent.update(screen.getByLabelText("Cilindraje"), "");
    expect(emitted()["update:modelValue"]).toEqual([[null]]);
  });

  it("aplica límites al salir", async () => {
    const { emitted } = render(EntradaNumero, { props: { ...base, min: 10, max: 500 }, global });
    const campo = screen.getByLabelText("Cilindraje");
    await fireEvent.update(campo, "900");
    await fireEvent.blur(campo);
    await fireEvent.update(campo, "3");
    await fireEvent.blur(campo);
    expect(emitted()["update:modelValue"]).toEqual([[900], [500], [3], [10]]);
    expect(emitted().blur).toHaveLength(2);
  });

  it("muestra el sufijo como texto decorativo", () => {
    render(EntradaNumero, { props: { ...base, sufijo: "cc" }, global });
    expect(screen.getByText("cc")).toHaveAttribute("aria-hidden", "true");
  });

  it("error y deshabilitado", () => {
    render(EntradaNumero, { props: { ...base, error: "Requerido", deshabilitado: true }, global });
    const campo = screen.getByLabelText("Cilindraje");
    expect(campo).toBeDisabled();
    expect(campo).toHaveAttribute("aria-invalid", "true");
  });
});
