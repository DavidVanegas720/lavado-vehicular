import { entorno } from "../config/entorno";
import type { ModuloApi } from "./tipos";

/**
 * Modo de un módulo según `VITE_API_MODO_<MODULO>` (default "mock").
 * `negocio` es provisional (H-07) y sigue el modo de `catalogo`.
 */
export function modoDe(modulo: ModuloApi): ModoApi {
  switch (modulo) {
    case "auth":
      return entorno.modoApi.auth;
    case "usuarios":
      return entorno.modoApi.usuarios;
    case "trabajadores":
      return entorno.modoApi.trabajadores;
    case "catalogo":
    case "negocio":
      return entorno.modoApi.catalogo;
    case "ordenes":
      return entorno.modoApi.ordenes;
    case "reportes":
      return entorno.modoApi.reportes;
    case "cierre-caja":
      return entorno.modoApi.cierreCaja;
  }
}
