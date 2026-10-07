import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import EstadoVacio from "./EstadoVacio.vue";

afterEach(cleanup);

describe("EstadoVacio", () => {
  it("muestra título y descripción sin rol alert", () => {
    render(EstadoVacio, { props: { titulo: "Sin órdenes", descripcion: "Crea la primera" } });
    expect(screen.getByRole("heading", { name: "Sin órdenes" })).toBeInTheDocument();
    expect(screen.getByText("Crea la primera")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renderiza ícono decorativo y slot accion", () => {
    const { container } = render(EstadoVacio, {
      props: { titulo: "Vacío", icono: "pi-inbox" },
      slots: { accion: "<button>Crear</button>" },
    });
    expect(container.querySelector("i.pi-inbox")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
  });

  it("tono error usa role alert", () => {
    render(EstadoVacio, { props: { titulo: "Falló", tono: "error" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Falló");
  });
});
