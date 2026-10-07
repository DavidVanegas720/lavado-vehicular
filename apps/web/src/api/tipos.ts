import type { ZodType } from "zod";

/** Resultado de toda petición: el llamador hace `switch` sobre `estado`. */
export type Resultado<T> =
  | { estado: "ok"; datos: T }
  | { estado: "no-autenticado" }
  | { estado: "espera"; segundos: number } // 429
  | { estado: "sin-respuesta" } // red / timeout
  | { estado: "servidor"; mensaje: string }; // 5xx / validación

/**
 * Módulos de API. Los de `arquitectura.md` que el frontend consume, más `negocio`
 * (provisional, H-07: la configuración del negocio aún no tiene módulo propio).
 */
export type ModuloApi =
  | "auth"
  | "usuarios"
  | "trabajadores"
  | "catalogo"
  | "ordenes"
  | "reportes"
  | "cierre-caja"
  | "negocio";

export type MetodoHttp = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ConsultaApi = Readonly<Record<string, string | number | boolean | undefined>>;

export interface Peticion<T> {
  readonly modulo: ModuloApi;
  readonly metodo: MetodoHttp;
  readonly ruta: string;
  readonly consulta?: ConsultaApi;
  readonly cuerpo?: unknown;
  readonly esquemaRespuesta: ZodType<T>;
}
