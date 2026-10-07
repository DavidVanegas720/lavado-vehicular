import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import VistaReportes from "./VistaReportes.vue";

describe("VistaReportes", () => {
  afterEach(cleanup);

  it("muestra encabezado, selector de rango y estado vacío", () => {
    render(VistaReportes);
    expect(screen.getByRole("heading", { level: 1, name: "Reportes" })).toBeInTheDocument();
    expect(screen.getByText("Periodo del reporte")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoy" })).toBeInTheDocument();
    expect(screen.getByText("Los reportes llegan en F1-5")).toBeInTheDocument();
  });
});
