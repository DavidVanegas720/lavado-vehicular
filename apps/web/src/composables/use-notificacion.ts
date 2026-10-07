import { useToast } from "primevue/usetoast";

export type SeveridadNotificacion = "success" | "error" | "info" | "warn";

/** Duración en ms por severidad (éxito 3 s, error 6 s; info/aviso 4 s). */
export const DURACION_NOTIFICACION: Readonly<Record<SeveridadNotificacion, number>> = {
  success: 3000,
  error: 6000,
  info: 4000,
  warn: 4000,
};

const TITULOS: Readonly<Record<SeveridadNotificacion, string>> = {
  success: "Listo",
  error: "Error",
  info: "Información",
  warn: "Atención",
};

export interface Notificador {
  exito: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
  aviso: (mensaje: string) => void;
}

/** Requiere `ToastService` instalado y `<Notificaciones />` montado una vez en `App.vue`. */
export function useNotificacion(): Notificador {
  const toast = useToast();
  const mostrar = (severity: SeveridadNotificacion, mensaje: string): void => {
    toast.add({
      severity,
      summary: TITULOS[severity],
      detail: mensaje,
      life: DURACION_NOTIFICACION[severity],
      closable: true,
    });
  };
  return {
    exito: (m) => {
      mostrar("success", m);
    },
    error: (m) => {
      mostrar("error", m);
    },
    info: (m) => {
      mostrar("info", m);
    },
    aviso: (m) => {
      mostrar("warn", m);
    },
  };
}
