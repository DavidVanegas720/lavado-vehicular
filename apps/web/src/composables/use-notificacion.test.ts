import { render, screen } from "@testing-library/vue";
import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import Notificaciones from "../componentes/base/Notificaciones.vue";
import { DURACION_NOTIFICACION, useNotificacion } from "./use-notificacion";

let api!: ReturnType<typeof useNotificacion>;
const Anfitrion = defineComponent({
  setup() {
    api = useNotificacion();
    return () => h(Notificaciones);
  },
});
const montar = () => render(Anfitrion, { global: { plugins: [PrimeVue, ToastService] } });

describe("useNotificacion + Notificaciones", () => {
  it("muestra cada tipo como alerta con su mensaje", async () => {
    montar();
    api.exito("Guardado");
    api.error("Falló");
    api.info("Dato");
    api.aviso("Cuidado");
    for (const texto of ["Guardado", "Falló", "Dato", "Cuidado"]) {
      expect(await screen.findByText(texto)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("alert")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Cerrar notificación" })).toHaveLength(4);
  });

  it("duraciones: éxito 3 s, error 6 s", () => {
    expect(DURACION_NOTIFICACION.success).toBe(3000);
    expect(DURACION_NOTIFICACION.error).toBe(6000);
  });
});
