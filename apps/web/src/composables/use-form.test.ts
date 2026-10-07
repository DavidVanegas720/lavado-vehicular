import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { z } from "zod";
import { useForm } from "./use-form";

const esquema = z.object({
  nombre: z.string().min(1, "Escribe el nombre"),
  edad: z.string().regex(/^\d+$/, "Solo números"),
});

const crear = () => useForm(esquema, { nombre: "", edad: "" });

describe("useForm", () => {
  it("no muestra errores hasta salir de un campo o enviar", () => {
    const f = crear();
    expect(f.errores.value).toEqual({});
  });

  it("alSalir valida solo ese campo", () => {
    const f = crear();
    f.alSalir("nombre");
    expect(f.errores.value).toEqual({ nombre: "Escribe el nombre" });
  });

  it("validar muestra todos los errores y devuelve null", () => {
    const f = crear();
    expect(f.validar()).toBeNull();
    expect(f.errores.value).toEqual({ nombre: "Escribe el nombre", edad: "Solo números" });
  });

  it("validar devuelve los datos tipados cuando son válidos", () => {
    const f = crear();
    f.valores.nombre = "Ana";
    f.valores.edad = "30";
    expect(f.validar()).toEqual({ nombre: "Ana", edad: "30" });
    expect(f.errores.value).toEqual({});
  });

  it("corrige en vivo un error ya mostrado", async () => {
    const f = crear();
    f.alSalir("nombre");
    f.valores.nombre = "Ana";
    await nextTick();
    expect(f.errores.value).toEqual({});
  });

  it("reiniciar restaura valores y limpia errores", () => {
    const f = crear();
    f.valores.nombre = "Ana";
    f.validar();
    f.reiniciar();
    expect(f.valores.nombre).toBe("");
    expect(f.errores.value).toEqual({});
  });

  it("id es estable y distinto por campo", () => {
    const f = crear();
    expect(f.id("nombre")).toBe(f.id("nombre"));
    expect(f.id("nombre")).not.toBe(f.id("edad"));
  });
});
