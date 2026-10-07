import { cleanup, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import TarjetaBase from "./TarjetaBase.vue";

afterEach(cleanup);

describe("TarjetaBase", () => {
  it("estática: título, subtítulo y slots; sin rol ni foco", () => {
    render(TarjetaBase, {
      props: { titulo: "Resumen", subtitulo: "Hoy" },
      slots: { default: "Contenido", pie: "Pie", acciones: "<button>Editar</button>" },
    });
    expect(screen.getByText("Resumen")).toBeInTheDocument();
    expect(screen.getByText("Hoy")).toBeInTheDocument();
    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(screen.getByText("Pie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("article")).not.toHaveAttribute("tabindex");
  });

  it("estática no emite seleccionar", async () => {
    const resultado = render(TarjetaBase, { props: { titulo: "A" } });
    await userEvent.click(screen.getByRole("article"));
    expect(resultado.emitted().seleccionar).toBeUndefined();
  });

  it("interactiva: clic, Enter y Espacio emiten seleccionar", async () => {
    const resultado = render(TarjetaBase, {
      props: { titulo: "A", interactiva: true, etiquetaAccesible: "Orden A" },
    });
    const t = screen.getByRole("button", { name: "Orden A" });
    expect(t).toHaveAttribute("tabindex", "0");
    await userEvent.click(t);
    t.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(resultado.emitted().seleccionar).toHaveLength(3);
  });

  it("slot encabezado reemplaza el título", () => {
    render(TarjetaBase, { props: { titulo: "X" }, slots: { encabezado: "<b>Propio</b>" } });
    expect(screen.getByText("Propio")).toBeInTheDocument();
    expect(screen.queryByText("X")).toBeNull();
  });
});
