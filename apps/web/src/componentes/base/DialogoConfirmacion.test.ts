/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import { describe, expect, it } from "vitest";
import DialogoConfirmacion from "./DialogoConfirmacion.vue";

const montar = (props: Record<string, unknown> = {}) =>
  render(DialogoConfirmacion, {
    props: { visible: true, titulo: "Anular orden", mensaje: "¿Seguro?", ...props },
    global: { plugins: [PrimeVue] },
  });

describe("DialogoConfirmacion", () => {
  it("confirmar emite confirmar sin motivo", async () => {
    const user = userEvent.setup();
    const { emitted } = montar({ etiquetaConfirmar: "Sí" });
    await screen.findByRole("dialog", { name: "Anular orden" });
    expect(screen.getByText("¿Seguro?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sí" }));
    expect(emitted().confirmar?.[0]).toEqual([undefined]);
  });

  it("cancelar emite cancelar y cierra", async () => {
    const user = userEvent.setup();
    const { emitted } = montar();
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(emitted().cancelar).toHaveLength(1);
    expect(emitted()["update:visible"]?.[0]).toEqual([false]);
  });

  it("peligroso: foco inicial en Cancelar", async () => {
    montar({ peligroso: true });
    await screen.findByRole("dialog");
    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole("button", { name: "Cancelar" }));
  });

  it("con motivo: confirmar deshabilitado hasta texto no vacío (trim) y emite el motivo", async () => {
    const user = userEvent.setup();
    const { emitted } = montar({ requiereMotivo: true, etiquetaMotivo: "Motivo de anulación" });
    await screen.findByRole("dialog");
    const confirmar = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmar).toBeDisabled();
    const campo = screen.getByLabelText("Motivo de anulación");
    await user.type(campo, "   ");
    expect(confirmar).toBeDisabled();
    await user.type(campo, " error de placa ");
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);
    expect(emitted().confirmar?.[0]).toEqual(["error de placa"]);
  });

  it("cargando no emite confirmar", async () => {
    const user = userEvent.setup();
    const { emitted } = montar({ cargando: true });
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(emitted().confirmar).toBeUndefined();
  });
});
