import { cleanup, fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import TablaBaseGenerica from "./TablaBase.vue";

// El componente es genérico (T); en los tests se usa sin parámetro de tipo.
const TablaBase = TablaBaseGenerica as unknown as Component;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function pantalla(ancha: boolean): void {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: ancha,
    media: consulta,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

interface Fila {
  id: string;
  nombre: string;
  precio: number;
  creada: string;
  dia: string;
}
const filas: Fila[] = [
  { id: "1", nombre: "Beta", precio: 3_000_000, creada: "2026-10-07T15:00:00Z", dia: "2026-10-07" },
  { id: "2", nombre: "Alfa", precio: 2_000_000, creada: "2026-10-07T16:30:00Z", dia: "2026-10-06" },
  {
    id: "3",
    nombre: "Gamma",
    precio: 2_500_000,
    creada: "2026-10-07T17:00:00Z",
    dia: "2026-10-05",
  },
];
const columnas = [
  { campo: "nombre", encabezado: "Nombre", ordenable: true },
  { campo: "precio", encabezado: "Precio", ordenable: true, formato: "dinero" as const },
  { campo: "creada", encabezado: "Creada", formato: "fecha-hora" as const },
  { campo: "dia", encabezado: "Día", formato: "dia" as const },
];

function nombresEnOrden(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((f) => within(f).getAllByRole("cell")[0]?.textContent.trim() ?? "");
}

describe("TablaBase (escritorio)", () => {
  it("renderiza encabezados, filas y formatos", () => {
    pantalla(true);
    render(TablaBase, { props: { filas, columnas, claveFila: "id" } });
    expect(screen.getByRole("table", { name: "Tabla de datos" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.getByText(/\$\s*30\.000/)).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText(/^5\s+de\s+oct/)).toBeInTheDocument();
  });

  it("ordena con aria-sort y alterna asc, desc, ninguno", async () => {
    pantalla(true);
    render(TablaBase, { props: { filas, columnas, claveFila: "id" } });
    const encabezado = screen.getByRole("columnheader", { name: /Nombre/ });
    expect(encabezado).toHaveAttribute("aria-sort", "none");
    await fireEvent.click(within(encabezado).getByRole("button"));
    expect(encabezado).toHaveAttribute("aria-sort", "ascending");
    expect(nombresEnOrden()).toEqual(["Alfa", "Beta", "Gamma"]);
    await fireEvent.click(within(encabezado).getByRole("button"));
    expect(encabezado).toHaveAttribute("aria-sort", "descending");
    expect(nombresEnOrden()).toEqual(["Gamma", "Beta", "Alfa"]);
    await fireEvent.click(within(encabezado).getByRole("button"));
    expect(encabezado).toHaveAttribute("aria-sort", "none");
  });

  it("ordena numéricamente por precio", async () => {
    pantalla(true);
    render(TablaBase, { props: { filas, columnas, claveFila: "id" } });
    await fireEvent.click(
      within(screen.getByRole("columnheader", { name: /Precio/ })).getByRole("button"),
    );
    expect(nombresEnOrden()).toEqual(["Alfa", "Gamma", "Beta"]);
  });

  it("filtra y muestra vacío sin resultados", async () => {
    pantalla(true);
    render(TablaBase, { props: { filas, columnas, claveFila: "id", filtrable: true } });
    const filtro = screen.getByLabelText("Filtrar");
    await fireEvent.update(filtro, "alf");
    expect(nombresEnOrden()).toEqual(["Alfa"]);
    await fireEvent.update(filtro, "zzz");
    expect(screen.getByRole("heading", { name: "Sin resultados" })).toBeInTheDocument();
  });

  it("pagina", async () => {
    pantalla(true);
    render(TablaBase, { props: { filas, columnas, claveFila: "id", tamanoPagina: 2 } });
    expect(nombresEnOrden()).toHaveLength(2);
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(nombresEnOrden()).toEqual(["Gamma"]);
  });

  it("estado cargando, vacío y error con reintentar", async () => {
    pantalla(true);
    const vista = render(TablaBase, {
      props: { filas: [], columnas, claveFila: "id", cargando: true },
    });
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    await vista.rerender({ cargando: false, textoVacio: "Nada aquí" });
    expect(screen.getByRole("heading", { name: "Nada aquí" })).toBeInTheDocument();
    await vista.rerender({ error: true });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(vista.emitted().reintentar).toHaveLength(1);
  });

  it("emite seleccionar-fila con clic y Enter", async () => {
    pantalla(true);
    const alSeleccionar = vi.fn();
    render(TablaBase, {
      props: { filas, columnas, claveFila: "id", onSeleccionarFila: alSeleccionar },
    });
    const fila = screen.getAllByRole("row")[1] as HTMLElement;
    expect(fila).toHaveAttribute("tabindex", "0");
    await fireEvent.click(fila);
    await fireEvent.keyDown(fila, { key: "Enter" });
    expect(alSeleccionar).toHaveBeenCalledTimes(2);
    expect(alSeleccionar).toHaveBeenCalledWith(filas[0]);
  });

  it("filas no son enfocables sin escuchador", () => {
    pantalla(true);
    render(TablaBase, { props: { filas, columnas, claveFila: "id" } });
    expect(screen.getAllByRole("row")[1]).not.toHaveAttribute("tabindex");
  });

  it("slot celda-<campo>", () => {
    pantalla(true);
    render(TablaBase, {
      props: { filas, columnas, claveFila: "id" },
      slots: {
        "celda-nombre": `<template #celda-nombre="{ valor }"><b>** {{ valor }}</b></template>`,
      },
    });
    expect(screen.getByText("** Beta")).toBeInTheDocument();
  });
});

describe("TablaBase (móvil)", () => {
  it("se renderiza como tarjetas apiladas, sin table", () => {
    pantalla(false);
    render(TablaBase, { props: { filas, columnas, claveFila: "id", etiqueta: "Servicios" } });
    expect(screen.queryByRole("table")).toBeNull();
    const lista = screen.getByRole("list", { name: "Servicios" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("Precio")).toHaveLength(3);
  });

  it("tarjeta seleccionable emite con Enter", async () => {
    pantalla(false);
    const alSeleccionar = vi.fn();
    render(TablaBase, {
      props: { filas, columnas, claveFila: "id", onSeleccionarFila: alSeleccionar },
    });
    const tarjeta = screen.getAllByRole("button")[0] as HTMLElement;
    await fireEvent.keyDown(tarjeta, { key: "Enter" });
    expect(alSeleccionar).toHaveBeenCalledWith(filas[0]);
  });
});
