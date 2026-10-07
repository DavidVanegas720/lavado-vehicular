import { z } from "zod";

const esquemaModo = z.enum(["mock", "http"], { error: 'Debe ser "mock" o "http"' });

const esquemaEntorno = z
  .object({
    VITE_SENTRY_DSN: z.string().optional(),
    VITE_MOCK_ERROR_RATE: z.coerce.number().min(0).max(1).default(0),
    VITE_MOCK_LATENCIA_MIN_MS: z.coerce.number().int().min(0).default(100),
    VITE_MOCK_LATENCIA_MAX_MS: z.coerce.number().int().min(0).default(300),
    VITE_API_MODO_AUTH: esquemaModo.default("mock"),
    VITE_API_MODO_USUARIOS: esquemaModo.default("mock"),
    VITE_API_MODO_TRABAJADORES: esquemaModo.default("mock"),
    VITE_API_MODO_CATALOGO: esquemaModo.default("mock"),
    VITE_API_MODO_ORDENES: esquemaModo.default("mock"),
    VITE_API_MODO_REPORTES: esquemaModo.default("mock"),
    VITE_API_MODO_CIERRE_CAJA: esquemaModo.default("mock"),
  })
  .refine((e) => e.VITE_MOCK_LATENCIA_MIN_MS <= e.VITE_MOCK_LATENCIA_MAX_MS, {
    path: ["VITE_MOCK_LATENCIA_MIN_MS"],
    error: "La latencia mínima no puede superar la máxima",
  });

export interface Entorno {
  readonly sentryDsn: string | undefined;
  readonly mockErrorRate: number;
  readonly mockLatenciaMinMs: number;
  readonly mockLatenciaMaxMs: number;
  readonly modoApi: {
    readonly auth: ModoApi;
    readonly usuarios: ModoApi;
    readonly trabajadores: ModoApi;
    readonly catalogo: ModoApi;
    readonly ordenes: ModoApi;
    readonly reportes: ModoApi;
    readonly cierreCaja: ModoApi;
  };
}

/** Valida las variables VITE_* y falla fuerte (en español) si alguna es inválida. */
export function leerEntorno(crudo: Record<string, unknown>): Entorno {
  const resultado = esquemaEntorno.safeParse(crudo);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join(".") || "(entorno)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración de entorno inválida. Revisá el archivo .env:\n${detalle}`);
  }
  const e = resultado.data;
  const dsn = e.VITE_SENTRY_DSN?.trim();
  return {
    sentryDsn: dsn === undefined || dsn === "" ? undefined : dsn,
    mockErrorRate: e.VITE_MOCK_ERROR_RATE,
    mockLatenciaMinMs: e.VITE_MOCK_LATENCIA_MIN_MS,
    mockLatenciaMaxMs: e.VITE_MOCK_LATENCIA_MAX_MS,
    modoApi: {
      auth: e.VITE_API_MODO_AUTH,
      usuarios: e.VITE_API_MODO_USUARIOS,
      trabajadores: e.VITE_API_MODO_TRABAJADORES,
      catalogo: e.VITE_API_MODO_CATALOGO,
      ordenes: e.VITE_API_MODO_ORDENES,
      reportes: e.VITE_API_MODO_REPORTES,
      cierreCaja: e.VITE_API_MODO_CIERRE_CAJA,
    },
  };
}

export const entorno: Entorno = leerEntorno(import.meta.env);
