import { z } from "zod";
import {
  esquemaPrecio,
  esquemaRangoCilindraje,
  esquemaServicio,
  type Precio,
  type RangoCilindraje,
  type Servicio,
} from "@lavado-vehicular/shared/esquemas/catalogo";
import "../mocks"; // registra los manejadores mock (solo se usan si el modo es "mock")
import { pedir } from "./cliente";
import type { Resultado } from "./tipos";

export function listarServicios(): Promise<Resultado<Servicio[]>> {
  return pedir({
    modulo: "catalogo",
    metodo: "GET",
    ruta: "/api/catalogo/servicios",
    esquemaRespuesta: z.array(esquemaServicio),
  });
}

export function listarRangos(): Promise<Resultado<RangoCilindraje[]>> {
  return pedir({
    modulo: "catalogo",
    metodo: "GET",
    ruta: "/api/catalogo/rangos",
    esquemaRespuesta: z.array(esquemaRangoCilindraje),
  });
}

export function listarPrecios(): Promise<Resultado<Precio[]>> {
  return pedir({
    modulo: "catalogo",
    metodo: "GET",
    ruta: "/api/catalogo/precios",
    esquemaRespuesta: z.array(esquemaPrecio),
  });
}
