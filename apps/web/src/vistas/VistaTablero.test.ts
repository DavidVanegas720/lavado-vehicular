import type { ResumenOrdenTablero } from "@lavado-vehicular/shared/esquemas/ordenes";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Resultado } from "@/api/tipos";
import VistaTablero from "./VistaTablero.vue";

const listarTableroDelDia = vi.hoisted(() => vi.fn());
const obtenerNegocioActual = vi.hoisted(() => vi.fn());
vi.mock("@/api/ordenes", () => ({ listarTableroDelDia }));
vi.mock("@/api/negocio", () => ({ obtenerNegocioActual }));

function orden(id: string, placa: string): ResumenOrdenTablero {
  return {
    id,
    estado: "LAVANDO",
    es_cortesia: false,
    motivo_cortesia: null,
    motivo_anulacion: null,
    rango_cilindraje_nombre_congelado: "Moto 0-200cc",
    created_at: "2026-10-07T15:30:00.000Z",
    placa,
    cilindraje: 150,
    trabajador_nombre: null,
    items: [],
    total_centavos: 2_000_000,
  } as unknown as ResumenOrdenTablero;
}

function responder(r: Resultado<ResumenOrdenTablero[]>): void {
  listarTableroDelDia.mockResolvedValue(r);
}

describe("VistaTablero", () => {
  beforeEach(() => {
    obtenerNegocioActual.mockResolvedValue({ estado: "sin-respuesta" });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("cargando: muestra el skeleton y el encabezado", () => {
    listarTableroDelDia.mockReturnValue(new Promise(() => undefined));
    render(VistaTablero);
    expect(screen.getByRole("heading", { level: 1, name: "Tablero del día" })).toBeInTheDocument();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("ok: una tarjeta por orden", async () => {
    responder({ estado: "ok", datos: [orden("1", "ABC123"), orden("2", "XYZ987")] });
    render(VistaTablero);
    expect(await screen.findByRole("article", { name: "Orden ABC123" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Orden XYZ987" })).toBeInTheDocument();
    expect(screen.queryByText("Cargando…")).toBeNull();
  });

  it("vacío: muestra el estado vacío", async () => {
    responder({ estado: "ok", datos: [] });
    render(VistaTablero);
    expect(await screen.findByText("Aún no hay órdenes hoy")).toBeInTheDocument();
  });

  it.each([
    [{ estado: "no-autenticado" }, /sesión/],
    [{ estado: "espera", segundos: 7 }, /7 s/],
    [{ estado: "sin-respuesta" }, /conexión/],
    [{ estado: "servidor", mensaje: "Falla interna" }, /Falla interna/],
  ] as [Resultado<ResumenOrdenTablero[]>, RegExp][])(
    "error %#: alerta y Reintentar",
    async (r, texto) => {
      responder(r);
      render(VistaTablero);
      expect(await screen.findByRole("alert")).toHaveTextContent(texto);
      responder({ estado: "ok", datos: [orden("1", "ABC123")] });
      await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByRole("article", { name: "Orden ABC123" })).toBeInTheDocument();
      expect(listarTableroDelDia).toHaveBeenCalledTimes(2);
    },
  );
});
