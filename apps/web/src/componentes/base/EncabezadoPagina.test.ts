import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import EncabezadoPagina from "./EncabezadoPagina.vue";

afterEach(cleanup);

describe("EncabezadoPagina", () => {
  it("renderiza h1 con tabindex -1 y subtítulo", () => {
    render(EncabezadoPagina, { props: { titulo: "Tablero", subtitulo: "Hoy" } });
    const h1 = screen.getByRole("heading", { level: 1, name: "Tablero" });
    expect(h1).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Hoy")).toBeInTheDocument();
  });

  it("sin slot acciones no renderiza contenedor de acciones", () => {
    render(EncabezadoPagina, { props: { titulo: "T" } });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("con slot acciones, baja debajo del título en móvil (flex-col)", () => {
    const { container } = render(EncabezadoPagina, {
      props: { titulo: "T" },
      slots: { acciones: "<button>Nueva</button>" },
    });
    expect(screen.getByRole("button", { name: "Nueva" })).toBeInTheDocument();
    expect(container.querySelector("header")?.className).toContain("flex-col");
  });
});
