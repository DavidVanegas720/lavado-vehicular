import { createRouter, createWebHistory } from "vue-router";
import VistaInicio from "@/vistas/VistaInicio.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", name: "inicio", component: VistaInicio }],
});
