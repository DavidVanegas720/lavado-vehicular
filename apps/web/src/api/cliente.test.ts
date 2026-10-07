import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { limpiarManejadoresParaPruebas, registrarManejador } from "../mocks/registro";
import { configurarClienteParaPruebas, pedir } from "./cliente";
import type { Peticion } from "./tipos";

const esquema = z.object({ id: z.string(), nombre: z.string() });
const peticion: Peticion<z.infer<typeof esquema>> = {
  modulo: "catalogo",
  metodo: "GET",
  ruta: "/api/prueba",
  esquemaRespuesta: esquema,
};

describe("cliente HTTP", () => {
  beforeEach(() => {
    limpiarManejadoresParaPruebas();
    configurarClienteParaPruebas({ latencia: [0, 0], tasaError: 0, modo: "mock" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    configurarClienteParaPruebas();
  });

  it("devuelve ok con la respuesta validada", async () => {
    registrarManejador("GET /api/prueba", () => ({
      estado: "ok",
      datos: { id: "1", nombre: "Lavado" },
    }));
    expect(await pedir(peticion)).toEqual({ estado: "ok", datos: { id: "1", nombre: "Lavado" } });
  });

  it("devuelve servidor si la respuesta no cumple el esquema", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarManejador("GET /api/prueba", () => ({ estado: "ok", datos: { id: 1 } }));
    const r = await pedir(peticion);
    expect(r.estado).toBe("servidor");
    expect(error).toHaveBeenCalled();
  });

  it("devuelve servidor con mensaje claro si no hay manejador", async () => {
    const r = await pedir(peticion);
    expect(r).toEqual({
      estado: "servidor",
      mensaje: "No hay manejador mock para GET /api/prueba",
    });
  });

  it("con tasa de error 1 siempre falla, alternando sin-respuesta y servidor", async () => {
    registrarManejador("GET /api/prueba", () => ({
      estado: "ok",
      datos: { id: "1", nombre: "x" },
    }));
    configurarClienteParaPruebas({ latencia: [0, 0], tasaError: 1, modo: "mock" });
    const estados = [
      (await pedir(peticion)).estado,
      (await pedir(peticion)).estado,
      (await pedir(peticion)).estado,
    ];
    expect(estados).toEqual(["sin-respuesta", "servidor", "sin-respuesta"]);
  });

  it("en modo http devuelve el stub de Fase 2", async () => {
    configurarClienteParaPruebas({ latencia: [0, 0], tasaError: 0, modo: "http" });
    expect(await pedir(peticion)).toEqual({
      estado: "servidor",
      mensaje: "Modo http disponible en Fase 2",
    });
  });

  it("el resultado no comparte referencias con el estado del mock", async () => {
    const estado = { id: "1", nombre: "Original" };
    registrarManejador("GET /api/prueba", () => ({ estado: "ok", datos: estado }));
    const r = await pedir(peticion);
    if (r.estado !== "ok") throw new Error("se esperaba ok");
    r.datos.nombre = "Mutado";
    expect(estado.nombre).toBe("Original");
    expect(r.datos).not.toBe(estado);
  });

  it("propaga estados no ok del manejador sin validar", async () => {
    registrarManejador("GET /api/prueba", () => ({ estado: "no-autenticado" }));
    expect(await pedir(peticion)).toEqual({ estado: "no-autenticado" });
  });
});
