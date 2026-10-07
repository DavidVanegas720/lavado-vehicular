/// <reference types="vite/client" />

type ModoApi = "mock" | "http";

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_MOCK_ERROR_RATE?: string;
  readonly VITE_MOCK_LATENCIA_MIN_MS?: string;
  readonly VITE_MOCK_LATENCIA_MAX_MS?: string;
  readonly VITE_API_MODO_AUTH?: ModoApi;
  readonly VITE_API_MODO_USUARIOS?: ModoApi;
  readonly VITE_API_MODO_TRABAJADORES?: ModoApi;
  readonly VITE_API_MODO_CATALOGO?: ModoApi;
  readonly VITE_API_MODO_ORDENES?: ModoApi;
  readonly VITE_API_MODO_REPORTES?: ModoApi;
  readonly VITE_API_MODO_CIERRE_CAJA?: ModoApi;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
