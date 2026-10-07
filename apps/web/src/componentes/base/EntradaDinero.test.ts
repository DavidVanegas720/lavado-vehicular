/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import { centavos, type Centavos } from "@lavado-vehicular/shared/dominio/dinero";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it } from "vitest";
import EntradaDinero from "./EntradaDinero.vue";

const global = { plugins: [PrimeVue] };

const norm = (s: string): string => s.replace(new RegExp(String.fromCharCode(160), "g"), " ");
const base = { etiqueta: "Precio", modelValue: null as Centavos | null };

afterEach(cleanup);

describe("EntradaDinero", () => {
  it("muestra el valor en centavos como pesos COP", () => {
    render(EntradaDinero, { props: { ...base, modelValue: centavos(3_000_000) }, global });
    expect(norm(screen.getByLabelText<HTMLInputElement>("Precio").value)).toBe("$ 30.000");
  });

  it("escribir 30000 pesos emite 3_000_000 centavos y formatea en vivo", async () => {
    const { emitted } = render(EntradaDinero, { props: base, global });
    const campo = screen.getByLabelText<HTMLInputElement>("Precio");
    await fireEvent.update(campo, "30000");
    expect(emitted()["update:modelValue"]).toEqual([[3_000_000]]);
    expect(norm(campo.value)).toBe("$ 30.000");
  });

  it("pegar '30.000' equivale a 30000 pesos", async () => {
    const { emitted } = render(EntradaDinero, { props: base, global });
    await fireEvent.update(screen.getByLabelText("Precio"), "30.000");
    expect(emitted()["update:modelValue"]).toEqual([[3_000_000]]);
  });

  it("ignora letras y vacío emite null", async () => {
    const { emitted } = render(EntradaDinero, {
      props: { ...base, modelValue: centavos(100) },
      global,
    });
    const campo = screen.getByLabelText("Precio");
    await fireEvent.update(campo, "a2b");
    await fireEvent.update(campo, "abc");
    expect(emitted()["update:modelValue"]).toEqual([[200], [null]]);
  });

  it("nunca emite un valor no entero", async () => {
    const { emitted } = render(EntradaDinero, { props: base, global });
    const campo = screen.getByLabelText("Precio");
    for (const texto of ["12,5", "1.5", "0,99", "99999999999999999999", "7e3"]) {
      await fireEvent.update(campo, texto);
    }
    const valores = (emitted()["update:modelValue"] ?? []).flat();
    for (const v of valores) expect(v === null || Number.isInteger(v)).toBe(true);
  });

  it("cero es null salvo que se permita", async () => {
    const sin = render(EntradaDinero, { props: base, global });
    await fireEvent.update(sin.getByLabelText("Precio"), "0");
    expect(sin.emitted()["update:modelValue"]).toEqual([[null]]);
    sin.unmount();
    const con = render(EntradaDinero, { props: { ...base, permiteCero: true }, global });
    await fireEvent.update(con.getByLabelText("Precio"), "0");
    expect(con.emitted()["update:modelValue"]).toEqual([[0]]);
  });

  it("rechaza lo que excede el máximo y sube al mínimo al salir", async () => {
    const { emitted } = render(EntradaDinero, {
      props: { ...base, min: centavos(100_000), max: centavos(500_000) },
      global,
    });
    const campo = screen.getByLabelText("Precio");
    await fireEvent.update(campo, "6000");
    expect(emitted()["update:modelValue"]).toBeUndefined();
    await fireEvent.update(campo, "500");
    expect(emitted()["update:modelValue"]).toEqual([[50_000]]);
  });

  it("sube al mínimo al salir", async () => {
    const { emitted } = render(EntradaDinero, {
      props: { ...base, modelValue: centavos(50_000), min: centavos(100_000) },
      global,
    });
    await fireEvent.blur(screen.getByLabelText("Precio"));
    expect(emitted()["update:modelValue"]).toEqual([[100_000]]);
    expect(emitted().blur).toHaveLength(1);
  });

  it("error y deshabilitado por ARIA", () => {
    render(EntradaDinero, { props: { ...base, error: "Inválido", deshabilitado: true }, global });
    const campo = screen.getByLabelText("Precio");
    expect(campo).toBeDisabled();
    expect(campo).toHaveAttribute("aria-invalid", "true");
  });
});
