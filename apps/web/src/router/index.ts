import { nextTick } from "vue";
import { enfocarEncabezado } from "@/componentes/layout/foco";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    titulo?: string;
  }
}

const SUFIJO_TITULO = "Lavado Vehicular";

export const rutas: RouteRecordRaw[] = [
  { path: "/", redirect: "/tablero" },
  {
    path: "/tablero",
    name: "tablero",
    component: () => import("@/vistas/VistaTablero.vue"),
    meta: { titulo: "Tablero" },
  },
  {
    path: "/catalogo",
    name: "catalogo",
    component: () => import("@/vistas/VistaCatalogo.vue"),
    meta: { titulo: "Catálogo" },
  },
  {
    path: "/reportes",
    name: "reportes",
    component: () => import("@/vistas/VistaReportes.vue"),
    meta: { titulo: "Reportes" },
  },
  // La galería solo existe en desarrollo; en producción cae en el 404.
  ...(import.meta.env.DEV
    ? [
        {
          path: "/componentes",
          name: "componentes",
          component: () => import("@/vistas/VistaGaleria.vue"),
          meta: { titulo: "Componentes" },
        } satisfies RouteRecordRaw,
      ]
    : []),
  {
    path: "/:pathMatch(.*)*",
    name: "no-encontrada",
    component: () => import("@/vistas/VistaNoEncontrada.vue"),
    meta: { titulo: "Página no encontrada" },
  },
];

/** Aplica título de documento y foco tras cada navegación. Reutilizable en tests. */
export function instalarGanchosNavegacion(enrutador: ReturnType<typeof createRouter>): void {
  enrutador.afterEach((destino) => {
    const titulo = destino.meta.titulo;
    document.title = titulo ? `${titulo} · ${SUFIJO_TITULO}` : SUFIJO_TITULO;
    // Si la vista ya está montada (sin transición) se enfoca ya; si no, lo hace la transición.
    void nextTick(enfocarEncabezado);
  });
}

export const router = createRouter({ history: createWebHistory(), routes: rutas });
instalarGanchosNavegacion(router);
