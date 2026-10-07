# Arquitectura del sistema

Este documento describe cómo está armado el sistema: stack, capas, módulos y deploy. Las justificaciones detalladas de cada decisión están en `decisiones.md`; acá se describe qué es, no por qué es así.

## Stack

**Backend:** Node.js 20 + Fastify + Prisma + Zod.

**Frontend:** Vue 3 (Composition API) + Vite + Pinia + Tailwind + PrimeVue.

**Base de datos:** PostgreSQL 16. En desarrollo corre en Docker (`docker-compose.yml` en la raíz). En producción, Postgres administrado (Neon).

**Monorepo:** pnpm workspaces, tres paquetes: `apps/api`, `apps/web`, `packages/shared`.

**Testing:** Vitest en los dos lados (backend y frontend) + Playwright para E2E por rebanada.

**Observabilidad:** Sentry desde el día uno, en frontend y backend. Free tier alcanza sin problema.

**Hosting:**
- Backend en Render (plan gratuito).
- Base de datos en Neon (plan gratuito).
- Frontend en Cloudflare Pages (plan gratuito).
- Respaldos en Cloudflare R2 (plan gratuito).
- Keep-alive vía cron-job.org (plan gratuito, ping cada 10 min al endpoint `/api/salud`).
- Respaldo diario disparado por GitHub Actions cron (no vive dentro del proceso de la API).

## Es un monolito, no microservicios

Un solo proceso Node/Fastify (`apps/api`) atiende todas las rutas HTTP. **No hay setInterval interno para tareas agendadas** — el respaldo lo dispara una GitHub Action externa contra un endpoint autenticado por secreto compartido. Esto es distinto al proyecto anterior y evita el problema de que la tarea agendada muera con el proceso.

La complejidad del sistema no viene de piezas moviéndose entre sí, viene del dominio. Un solo proceso alcanza y sobra para un negocio con un mostrador.

## Backend: controlador → servicio → repositorio, en módulos por dominio

Fastify organiza el código en plugins. Cada módulo del dominio es un plugin. La estructura interna de cada módulo es siempre la misma:

```
apps/api/src/modulos/<nombre>/
  rutas.ts           <- controlador: recibe request, valida con Zod, llama al servicio
  servicio.ts        <- lógica de dominio: reglas de dinero, congelamientos, permisos
  repositorio.ts     <- única capa que arma consultas Prisma
  esquemas.ts        <- Zod schemas de request/response, re-exportados a packages/shared
```

**Regla estricta de comunicación entre capas:**
- El controlador NO toca Prisma directamente.
- El servicio NO toca Prisma directamente.
- Solo el repositorio arma consultas.
- El filtro por `negocio_id` vive **exclusivamente** en el repositorio. Ni controlador ni servicio lo aplican a mano.

Esto es lo que permite que RLS multi-tenant sea aditivo el día que aparezca un segundo negocio: se agrega en una migración, sin tocar código de aplicación, porque el filtro ya está centralizado.

## Módulos del backend

Nueve módulos, uno por dominio del negocio:

1. `auth` — inicio de sesión, cierre, verificación de sesión, cambio de contraseña.
2. `usuarios` — dueño y operadores del negocio (los que sí inician sesión).
3. `trabajadores` — lavadores (no inician sesión) y sus acuerdos de comisión históricos.
4. `catalogo` — servicios (paquetes y adicionales), precios por rango de cilindraje, rangos de cilindraje.
5. `ordenes` — el núcleo del dominio: crear, asignar lavador, marcar lista, cobrar, entregar, anular.
6. `reportes` — diario, semanal, mensual. Motos lavadas, dinero ingresado, comisiones.
7. `cierre-caja` — un cierre por día operativo por negocio.
8. `salud` — endpoint público para el keep-alive externo. NO toca la base.
9. `respaldo` — endpoint autenticado por secreto compartido que dispara un dump y lo sube a R2.

## Frontend → backend: HTTP + JSON, cookie de sesión, mismo origen

REST convencional, no GraphQL, no tRPC, no WebSockets.

- El frontend llama `fetch()` contra rutas `/api/*`.
- Todos los request y response validados por Zod. Los esquemas viven en `apps/api/src/modulos/<nombre>/esquemas.ts` y se re-exportan desde `packages/shared` para que el frontend importe los tipos sin duplicar nada. **Durante Fase 1 (frontend puro), los esquemas viven directamente en `packages/shared` y son la única fuente de verdad; en Fase 2 el backend los adopta.**
- La sesión es una cookie `httpOnly`, no un token en `localStorage`. Ver `decisiones.md` para el porqué (revocación real, no expiración pasiva). **Durante F1, la sesión se simula con `sessionStorage`; el reemplazo a cookie httpOnly ocurre en F2-1.**
- **Toda petición del frontend pasa por un único archivo:** `apps/web/src/api/cliente.ts`, que expone una función `pedir<T>()` que devuelve una unión discriminada de resultados (`ok`, `no-autenticado`, `espera`, `sin-respuesta`, `servidor`). TypeScript obliga a manejar cada caso. Ninguna pantalla llama a `fetch` directamente.

### Modo mock vs modo http (según fase)

El cliente HTTP tiene dos implementaciones intercambiables detrás de la misma interfaz. Ver D-28 en `decisiones.md`.

- **Modo `mock`** (Fase 1): las llamadas de `pedir()` no salen a la red. Van a `apps/web/src/mocks/`, que expone funciones que devuelven datos consistentes con el modelo de dominio (mismo formato de respuesta que el backend real dará en F2). Los mocks son módulos por dominio (`mocks/ordenes.ts`, `mocks/catalogo.ts`, etc.), mantienen estado en memoria durante la sesión del navegador, y respetan las seis reglas no negociables: dinero en centavos enteros, precios congelados por orden, día operativo por función única, nada se borra (solo se marca inactivo).
- **Modo `http`** (Fase 2, se activa por módulo): `pedir()` hace `fetch` real contra `/api/*`. Se activa por variable de entorno (`VITE_API_MODO_ORDENES=http`, uno por módulo). Un módulo puede estar en `http` mientras otro sigue en `mock`, hasta que todo F2 esté cerrado.

Las vistas nunca saben qué modo está activo. La interfaz de `pedir()` es la misma. Este es el mecanismo que hace posible reemplazar la capa gradualmente sin tocar las vistas.

**Mismo origen para evitar cookies de terceros:** en producción, `*.pages.dev` (frontend) y `*.onrender.com` (backend) son dominios distintos. Sin nada más, la cookie sería de terceros y necesitaría `SameSite=None`. Solución: una Pages Function en Cloudflare (`apps/web/functions/api/[[path]].ts`) que reenvía `/api/*` a Render sin reescribir nada. Desde el punto de vista del navegador, frontend y backend son el mismo sitio. **Esto se configura en FP-F2-3, no antes.**

## Frontend: Vue 3 + composables cuando hay reutilización

- Vistas (`.vue`) casi todas plantilla + eventos. La lógica de negocio que se comparta entre vistas va a un composable en `apps/web/src/composables/`.
- **Regla:** un composable existe cuando hay reutilización real o clara probabilidad de ella. No cada vista tiene su composable propio automáticamente. Empezar con la lógica en el `<script setup>` y factorizar al composable cuando aparezca la segunda copia.
- Stores de Pinia solo para estado global de verdad: sesión activa, aviso de arranque en frío, aviso de negocio suspendido. No es un cajón general.
- PrimeVue aporta los componentes de interfaz (tablas, diálogos, selectores). Tailwind el layout.

## packages/shared

Un solo paquete compartido. Contiene:
- Los esquemas Zod re-exportados del backend, para que el frontend importe los tipos.
- La función de cálculo de comisión y redondeo. Es la única lógica de dinero que corre en el navegador, y solo para mostrar un total antes de guardar. El cálculo que cuenta, el que se persiste, lo rehace siempre el backend.

**Sin doble build CJS+ESM.** Vitest corre en los dos lados (backend con Node, frontend con navegador virtual), lo que elimina la tarea T-007 del proyecto anterior.

## Autenticación

- Cookie de sesión `httpOnly`, `Secure`, `SameSite=Lax`, con un token opaco (no JWT).
- La sesión vive en la tabla `sesiones`, indexada por token. Cerrar sesión de alguien es borrar una fila.
- Contraseñas hasheadas con `argon2id`.
- El endpoint de cambio de contraseña obliga a re-verificar la actual.
- Middleware en Fastify que corre antes que todo lo que necesita usuario autenticado, adjunta el usuario y su `negocio_id` al contexto de la petición.

## Testing

Tres niveles, cada uno para lo que sirve:

1. **Unitario (Vitest)** — pura función. Cálculo de comisión, día operativo, congelamiento, redondeo, validación de Zod. Corre en milisegundos.
2. **Integración (Vitest + Postgres en Docker)** — servicio + repositorio contra una base real. Testea las consultas y las transacciones. Corre en segundos.
3. **End-to-end (Playwright)** — una prueba por rebanada, mínimo. Levanta backend + frontend + base y hace la acción completa desde el navegador. Es el nivel que convierte "suite verde" en "el sistema funciona".

**Regla:** ninguna rebanada se cierra sin al menos una prueba E2E que ejerce su flujo principal.

## Observabilidad

Sentry en el frontend (captura errores de JavaScript y de la UI) y en el backend (captura excepciones no manejadas de Fastify). En modo desarrollo escribe también a consola.

## Migraciones

- Manejadas por Prisma Migrate.
- **Un comando propio, `pnpm db:migrar-prod`, envuelve `prisma migrate deploy` con dos protecciones:**
  1. Imprime contra qué host va a correr.
  2. Exige teclear el nombre del host para confirmar.
- Al arrancar el backend en producción, la aplicación verifica que la última migración esperada está aplicada y **falla ruidosamente** si no lo está. Nada de "el sistema arrancó bien pero no puede escribir en una tabla nueva".

## Estructura de carpetas

```
lavado-vehicular/
├── CLAUDE.md
├── PROMPT-INICIAL.md
├── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .github/workflows/         (CI: lint + typecheck + tests + respaldo diario)
├── docs/                      (documentos de referencia)
├── .plan/                     (planes por tarea, no se commitea a main)
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modulos/       (uno por dominio, ver arriba)
│   │   │   ├── comun/         (utilitarios: día operativo, redondeo, sentry)
│   │   │   ├── plugins/       (fastify plugins: cors, cookies, auth)
│   │   │   └── main.ts
│   │   ├── prisma/            (schema.prisma + migraciones)
│   │   └── tests/             (integración)
│   └── web/
│       ├── src/
│       │   ├── vistas/
│       │   ├── composables/
│       │   ├── stores/
│       │   ├── componentes/
│       │   ├── api/           (cliente.ts, único punto de HTTP)
│       │   └── main.ts
│       ├── functions/         (Cloudflare Pages Function para proxy)
│       └── e2e/               (Playwright)
└── packages/
    └── shared/
        ├── src/
        │   ├── esquemas/      (Zod re-exportados)
        │   └── dominio/       (comisión, redondeo)
        └── package.json
```

## Lo que NO está en la arquitectura y no se agrega ahora

- **RLS y roles múltiples de PostgreSQL.** El filtro por `negocio_id` en repositorio alcanza mientras haya un solo negocio.
- **Colas / workers separados.** No hay cargas de trabajo asíncronas que lo justifiquen. El respaldo lo dispara un cron externo.
- **Caché de aplicación (Redis, etc.).** El volumen no lo pide.
- **CDN aparte del que ya trae Cloudflare Pages.**
- **Microservicios de cualquier tipo.**

Todo esto puede agregarse el día que un problema real lo pida. Ninguno se anticipa.
