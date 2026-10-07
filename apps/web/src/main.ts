import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import { createApp } from "vue";
import { aplicarTemaInicial } from "./composables/use-tema";
import { opcionesTema, presetLavado } from "./tema/preset";
import App from "./App.vue";
import "./config/entorno"; // valida el .env al arrancar y falla ruidosamente si es inválido
import "primeicons/primeicons.css";
import "./estilos/principal.css";
import { iniciarObservabilidad } from "./observabilidad/sentry";
import { router } from "./router";

aplicarTemaInicial(); // antes de montar: evita el parpadeo de tema sin script inline (CSP de F2)
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: { preset: presetLavado, options: opcionesTema },
});
app.use(ToastService);
app.use(ConfirmationService);
iniciarObservabilidad(app, router);
app.mount("#app");
