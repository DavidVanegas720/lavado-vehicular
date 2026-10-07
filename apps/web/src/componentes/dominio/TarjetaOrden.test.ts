import type { ResumenOrdenTablero } from "@lavado-vehicular/shared/esquemas/ordenes";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import TarjetaOrden from "./TarjetaOrden.vue";

afterEach(cleanup);

function item(n: number, nombre: string, precio: number): ResumenOrdenTablero["items"][number] {
  return {
    id: `i${String(n)}`,
    orden_id: "o1",
    servicio_id: `s${String(n)}`,
    servicio_nombre_congelado: nombre,
    precio_centavos_congelado: precio,
    created_at: `2026-10-07T15:0${String(n)}:00.000Z`,
  } as ResumenOrdenTablero["items"][number];
}

function crear(extra: Partial<ResumenOrdenTablero> = {}): ResumenOrdenTablero {
  return {
    id: "o1",
    estado: "LAVANDO",
    es_cortesia: false,
    motivo_cortesia: null,
    motivo_anulacion: null,
    rango_cilindraje_nombre_congelado: "Moto 0-200cc",
    created_at: "2026-10-07T15:30:00.000Z",
    placa: "ABC123",
    cilindraje: 150,
    trabajador_nombre: "Pedro",
    items: [item(1, "Lavado básico", 2_000_000), item(2, "Cera", 500_000)],
    total_centavos: 2_500_000,
    ...extra,
  } as ResumenOrdenTablero;
}

describe("TarjetaOrden", () => {
  it("muestra placa, estado, paquete, adicionales, rango, trabajador, hora y total", () => {
    render(TarjetaOrden, { props: { orden: crear() } });
    expect(screen.getByRole("article", { name: "Orden ABC123" })).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("Lavando")).toBeInTheDocument();
    expect(screen.getByText(/Lavado básico/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 adicional/)).toBeInTheDocument();
    expect(screen.getByText("Moto 0-200cc")).toBeInTheDocument();
    expect(screen.getByText(/Pedro/)).toBeInTheDocument();
    expect(screen.getByText("10:30")).toBeInTheDocument();
    expect(screen.getByText(/25\.000/)).toBeInTheDocument();
    expect(screen.queryByText("Cortesía")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sin trabajador muestra Sin asignar; sin adicionales no los menciona", () => {
    render(TarjetaOrden, {
      props: { orden: crear({ trabajador_nombre: null, items: [item(1, "Solo", 100_000)] }) },
    });
    expect(screen.getByText(/Sin asignar/)).toBeInTheDocument();
    expect(screen.queryByText(/adicional/)).toBeNull();
  });

  it("plural de adicionales y etiqueta Cortesía", () => {
    render(TarjetaOrden, {
      props: {
        orden: crear({
          es_cortesia: true,
          motivo_cortesia: "Amigo",
          items: [item(1, "A", 1), item(2, "B", 1), item(3, "C", 1)],
        }),
      },
    });
    expect(screen.getByText(/\+2 adicionales/)).toBeInTheDocument();
    expect(screen.getByText("Cortesía")).toBeInTheDocument();
  });

  it("anulada se distingue con borde discontinuo", () => {
    render(TarjetaOrden, {
      props: { orden: crear({ estado: "ANULADA", motivo_anulacion: "Error" }) },
    });
    expect(screen.getByRole("article")).toHaveClass("border-dashed");
    expect(screen.getByText("Anulada")).toBeInTheDocument();
  });

  it("clic y Enter emiten seleccionar con el id; es enfocable", async () => {
    const r = render(TarjetaOrden, { props: { orden: crear(), compacta: true } });
    const t = screen.getByRole("article");
    expect(t).toHaveAttribute("tabindex", "0");
    await userEvent.click(t);
    t.focus();
    await userEvent.keyboard("{Enter}");
    expect(r.emitted().seleccionar).toEqual([["o1"], ["o1"]]);
  });
});
