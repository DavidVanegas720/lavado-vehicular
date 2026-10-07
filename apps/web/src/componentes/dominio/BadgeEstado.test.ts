import { ESTADOS_ORDEN } from "@lavado-vehicular/shared/esquemas/ordenes";
import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import BadgeEstado from "./BadgeEstado.vue";

afterEach(cleanup);

const etiquetas = {
  CREADA: "Creada",
  LAVANDO: "Lavando",
  LISTA: "Lista",
  COBRADA: "Cobrada",
  ENTREGADA: "Entregada",
  ANULADA: "Anulada",
} as const;

describe("BadgeEstado", () => {
  it.each(ESTADOS_ORDEN)("%s muestra etiqueta en texto e ícono decorativo", (estado) => {
    const { container } = render(BadgeEstado, { props: { estado } });
    expect(screen.getByText(etiquetas[estado])).toBeInTheDocument();
    expect(container.querySelector("i.pi")).toHaveAttribute("aria-hidden", "true");
  });

  it("usa tokens de color del estado (ambos temas vía variables)", () => {
    const { container } = render(BadgeEstado, { props: { estado: "LISTA" } });
    expect(container.firstElementChild?.className).toContain("text-estado-lista");
    expect(container.firstElementChild?.className).toContain("bg-estado-lista-fondo");
  });

  it("solo ANULADA va tachado", () => {
    const { container: a } = render(BadgeEstado, { props: { estado: "ANULADA" } });
    expect(a.firstElementChild).toHaveClass("line-through");
    const { container: b } = render(BadgeEstado, { props: { estado: "COBRADA" } });
    expect(b.firstElementChild).not.toHaveClass("line-through");
  });

  it("tamaños sm y md", () => {
    const { container: sm } = render(BadgeEstado, { props: { estado: "CREADA", tamano: "sm" } });
    expect(sm.firstElementChild).toHaveClass("text-pequeno");
    const { container: md } = render(BadgeEstado, { props: { estado: "CREADA" } });
    expect(md.firstElementChild).toHaveClass("text-base");
  });
});
