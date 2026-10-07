import * as Sentry from "@sentry/vue";
import type { App } from "vue";
import type { Router } from "vue-router";
import { entorno } from "@/config/entorno";

const ETIQUETA = "[observabilidad]";

/**
 * Con DSN: Sentry real. Sin DSN (modo consola, el de F1): los errores no manejados se escriben en
 * console.error sin tragarlos.
 */
export function iniciarObservabilidad(app: App, router: Router, dsn = entorno.sentryDsn): void {
  if (dsn !== undefined) {
    Sentry.init({ app, dsn, integrations: [Sentry.browserTracingIntegration({ router })] });
    return;
  }

  app.config.errorHandler = (error, _instancia, info) => {
    console.error(ETIQUETA, "error de componente", info, error);
  };
  window.addEventListener("error", (evento) => {
    console.error(ETIQUETA, "error no capturado", evento.error ?? evento.message);
  });
  window.addEventListener("unhandledrejection", (evento) => {
    console.error(ETIQUETA, "promesa rechazada sin manejar", evento.reason);
  });
}
