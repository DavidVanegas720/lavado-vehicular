/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it } from "vitest";
import EntradaCorreo from "./EntradaCorreo.vue";

const global = { plugins: [PrimeVue] };

afterEach(cleanup);

describe("EntradaCorreo", () => {
  it("es type email con autocomplete email", () => {
    render(EntradaCorreo, { props: { etiqueta: "Correo", modelValue: "" }, global });
    const campo = screen.getByLabelText("Correo");
    expect(campo).toHaveAttribute("type", "email");
    expect(campo).toHaveAttribute("autocomplete", "email");
  });

  it("recorta espacios al salir y emite el valor recortado", async () => {
    const { emitted } = render(EntradaCorreo, {
      props: { etiqueta: "Correo", modelValue: "" },
      global,
    });
    const campo = screen.getByLabelText("Correo");
    await fireEvent.update(campo, "  a@b.co  ");
    await fireEvent.blur(campo);
    // jsdom (como el navegador) ya sanea los espacios de un type=email; el componente emite sin ellos.
    expect(emitted()["update:modelValue"]?.at(-1)).toEqual(["a@b.co"]);
    expect(emitted().blur).toHaveLength(1);
    expect(campo).toHaveValue("a@b.co");
  });

  it("muestra error accesible", () => {
    render(EntradaCorreo, {
      props: { etiqueta: "Correo", modelValue: "", error: "Correo inválido" },
      global,
    });
    expect(screen.getByLabelText("Correo")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Correo")).toHaveAccessibleDescription("Correo inválido");
  });
});
