import Aura from "@primeuix/themes/aura";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import { createApp } from "vue";
import App from "./App.vue";
import "./config/entorno"; // valida el .env al arrancar y falla ruidosamente si es inválido
import "./estilos/principal.css";
import { iniciarObservabilidad } from "./observabilidad/sentry";
import { router } from "./router";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: ".app-oscuro",
      cssLayer: { name: "primevue", order: "theme, base, primevue" },
    },
  },
});
app.use(ToastService);
app.use(ConfirmationService);
iniciarObservabilidad(app, router);
app.mount("#app");
