/* eslint-disable @typescript-eslint/unbound-method -- `emitted` de testing-library está ligado a su instancia */
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import { describe, expect, it } from "vitest";
import DialogoModal from "./DialogoModal.vue";

const montar = (props: Record<string, unknown> = {}) =>
  render(DialogoModal, {
    props: { visible: true, titulo: "Detalle", ...props },
    slots: { default: "<p>Contenido</p>" },
    global: { plugins: [PrimeVue] },
  });

describe("DialogoModal", () => {
  it("expone role dialog modal con nombre y descripción", async () => {
    montar({ descripcion: "Explicación" });
    const dialogo = await screen.findByRole("dialog", { name: "Detalle" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(screen.getByText("Explicación")).toBeInTheDocument();
  });

  it("no renderiza nada si no está visible", () => {
    montar({ visible: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc y botón cerrar emiten update:visible(false)", async () => {
    const user = userEvent.setup();
    const { emitted } = montar();
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(emitted()["update:visible"]?.[0]).toEqual([false]);
  });

  it("cerrable=false oculta el botón cerrar", async () => {
    montar({ cerrable: false });
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
  });
});
