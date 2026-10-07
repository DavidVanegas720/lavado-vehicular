import type { Precio, RangoCilindraje, Servicio } from "@lavado-vehicular/shared/esquemas/catalogo";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VistaCatalogo from "./VistaCatalogo.vue";

const api = vi.hoisted(() => ({
  listarServicios: vi.fn(),
  listarRangos: vi.fn(),
  listarPrecios: vi.fn(),
}));
vi.mock("@/api/catalogo", () => api);

const servicios = [
  { id: "s1", tipo: "PAQUETE", nombre: "Lavado básico", activo: true },
  { id: "s2", tipo: "ADICIONAL", nombre: "Cera", activo: false },
] as unknown as Servicio[];
const rangos = [
  { id: "r2", nombre: "Moto 201+", orden_visualizacion: 2, activo: true },
  { id: "r1", nombre: "Moto 0-200", orden_visualizacion: 1, activo: true },
] as unknown as RangoCilindraje[];
const precios = [
  { id: "p1", servicio_id: "s1", rango_cilindraje_id: "r1", precio_centavos: 2_000_000 },
] as unknown as Precio[];

function responderOk(s: Servicio[] = servicios): void {
  api.listarServicios.mockResolvedValue({ estado: "ok", datos: s });
  api.listarRangos.mockResolvedValue({ estado: "ok", datos: rangos });
  api.listarPrecios.mockResolvedValue({ estado: "ok", datos: precios });
}

function simularEscritorio(): void {
  const mm = (consulta: string): MediaQueryList =>
    ({
      matches: true,
      media: consulta,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", mm);
  window.matchMedia = mm;
}

describe("VistaCatalogo", () => {
  beforeEach(simularEscritorio);
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("cargando: skeleton", () => {
    api.listarServicios.mockReturnValue(new Promise(() => undefined));
    api.listarRangos.mockReturnValue(new Promise(() => undefined));
    api.listarPrecios.mockReturnValue(new Promise(() => undefined));
    render(VistaCatalogo);
    expect(screen.getByRole("heading", { level: 1, name: "Catálogo" })).toBeInTheDocument();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("ok: servicios, tipo, activo y precios por rango", async () => {
    responderOk();
    render(VistaCatalogo);
    expect(await screen.findByText("Lavado básico")).toBeInTheDocument();
    expect(screen.getByText("Paquete")).toBeInTheDocument();
    expect(screen.getByText("Adicional")).toBeInTheDocument();
    expect(screen.getByText(/20\.000/)).toBeInTheDocument();
    const encabezados = screen.getAllByRole("columnheader").map((e) => e.textContent.trim());
    expect(encabezados.indexOf("Moto 0-200")).toBeLessThan(encabezados.indexOf("Moto 201+"));
  });

  it("vacío: texto de catálogo vacío", async () => {
    responderOk([]);
    render(VistaCatalogo);
    expect(await screen.findByText("No hay servicios en el catálogo")).toBeInTheDocument();
  });

  it("error: alerta y Reintentar recarga", async () => {
    api.listarServicios.mockResolvedValue({ estado: "servidor", mensaje: "x" });
    api.listarRangos.mockResolvedValue({ estado: "ok", datos: rangos });
    api.listarPrecios.mockResolvedValue({ estado: "ok", datos: precios });
    render(VistaCatalogo);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    responderOk();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Lavado básico")).toBeInTheDocument();
  });
});
