import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import SkeletonCargando from "./SkeletonCargando.vue";

afterEach(cleanup);

describe("SkeletonCargando", () => {
  it.each(["texto", "tarjeta", "tabla", "circulo"] as const)(
    "variante %s: aria-busy y texto sr-only",
    (variante) => {
      render(SkeletonCargando, { props: { variante } });
      expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Cargando…")).toHaveClass("sr-only");
    },
  );

  it("texto respeta líneas", () => {
    const { container } = render(SkeletonCargando, { props: { variante: "texto", lineas: 4 } });
    expect(container.querySelectorAll(".h-4")).toHaveLength(4);
  });

  it("tabla respeta filas", () => {
    const { container } = render(SkeletonCargando, { props: { variante: "tabla", filas: 3 } });
    expect(container.querySelectorAll(".h-10")).toHaveLength(3);
  });

  it("sin animación en movimiento reducido", () => {
    const { container } = render(SkeletonCargando, { props: { variante: "texto" } });
    const barra = container.querySelector(".animate-pulse");
    expect(barra?.className).toContain("motion-reduce:animate-none");
  });
});
