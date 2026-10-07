# Plan FP-0 — Bootstrap del monorepo (solo frontend)

Rebanada: `docs/rebanadas.md` → "FP-0". Autorizado por David (D-28, arranque de Fase 1).
Rama: `tarea/fp-0-bootstrap`. Ejecución recomendada: **un solo agente, secuencial** (casi todo toca
`package.json` / `pnpm-lock.yaml`; paralelizar genera conflictos en el lockfile y no ahorra tiempo).

## Alcance

**Sí:** raíz pnpm, `packages/shared` (esquemas Zod del modelo + dinero en centavos + día operativo),
`apps/web` (Vue 3 + Vite + Pinia + Router + Tailwind + PrimeVue + TS strict), ESLint + Prettier,
Vitest (+ VTU + Testing Library), Playwright, Sentry en modo consola, `.gitignore`, `.env.example`,
scripts `typecheck` / `test` / `lint` / `e2e` / `verificar`.
**Instala también todas las dependencias que F1-1 necesita** (para que los agentes de F1-1 no toquen
`package.json` en paralelo).

**No:** `apps/api`, Prisma, Docker, despliegue, CI remoto, Dependabot, gitleaks, `pnpm audit` en CI
(diferidos por David → H-04 en `docs/pendientes.md`). Nada de vistas reales ni componentes (eso es F1-1).

## Entorno (leer antes de empezar)

- `export PATH=~/.local/bin:$PATH` en **cada** comando de shell (pnpm vive ahí). Node local: v24.
- Sin permisos en `/usr/local`: nada de `npm i -g`, `corepack enable` global ni `sudo`.
- Navegadores de Playwright: `pnpm --filter @lavado-vehicular/web exec playwright install chromium`
  (descarga a `~/Library/Caches/ms-playwright`, no requiere permisos de sistema).
- Si pnpm avisa "ignored build scripts" (p. ej. `esbuild`), aprobarlo con `pnpm approve-builds` o
  `onlyBuiltDependencies` en `pnpm-workspace.yaml` y anotarlo en `docs/registro/errores.md`.
- Versiones: instalar la última estable de cada paquete y registrar las versiones mayores resultantes
  en `docs/registro/decisiones-tomadas.md`. Si una API difiere de lo que dice este plan, seguir la
  documentación de la versión instalada y registrarlo en `errores.md`.

## Pasos

### Paso 0 — Preparar git
1. En `main` hay renombres de docs sin commitear (`git status`). Commitear en `main`:
   `docs: mover documentos a docs/ y agregar registro y planes` (incluye `docs/`, `docs/registro/`, `.plan/`).
2. `git switch -c tarea/fp-0-bootstrap`. **No hacer push** salvo que David lo pida.

### Paso 1 — Raíz del monorepo
- `package.json`: `private: true`, `name: "lavado-vehicular"`, `type: "module"`,
  `packageManager: "pnpm@<versión de pnpm -v>"`, `engines.node: ">=24"` (ver H-02).
- Scripts raíz:
  - `dev` → `pnpm --filter @lavado-vehicular/web dev`
  - `build` → `pnpm -r --if-present build`
  - `typecheck` → `pnpm -r --if-present typecheck`
  - `test` → `pnpm -r --if-present test`
  - `lint` → `eslint .` · `format` → `prettier --write .` · `format:check` → `prettier --check .`
  - `e2e` → `pnpm --filter @lavado-vehicular/web e2e`
  - `verificar` → `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
- `pnpm-workspace.yaml`: `packages: ["apps/*", "packages/*"]`.
- `.nvmrc` (`24`), `.editorconfig` (utf-8, lf, 2 espacios).
- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `module/moduleResolution: "ESNext"/"Bundler"`,
  `target: "ES2022"`, `skipLibCheck`. **Sin** `exactOptionalPropertyTypes` (fricción con PrimeVue).
- `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.vite/`, `*.log`, `.DS_Store`, `.env`, `.env.*`,
  `!.env.example`, `apps/web/playwright-report/`, `apps/web/test-results/`, `apps/web/blob-report/`.
  **`.plan/` NO se ignora** (ver H-05).
- `.env.example` (raíz, documentado línea por línea, sin valores secretos):
  `VITE_SENTRY_DSN=`, `VITE_MOCK_ERROR_RATE=0`, `VITE_MOCK_LATENCIA_MIN_MS=100`,
  `VITE_MOCK_LATENCIA_MAX_MS=300`, y uno `VITE_API_MODO_<MODULO>=mock` por módulo
  (`AUTH, USUARIOS, TRABAJADORES, CATALOGO, ORDENES, REPORTES, CIERRE_CAJA`).
  Vite debe leerlo desde la raíz: `envDir: "../.."` en `apps/web/vite.config.ts`.

### Paso 2 — `packages/shared`
`package.json`: `name: "@lavado-vehicular/shared"`, `type: "module"`, `private: true`,
`exports: { "./esquemas/*": "./src/esquemas/*.ts", "./dominio/*": "./src/dominio/*.ts" }`
(se consume como fuente TS, sin build — D-05 "sin doble build"; F2 decide si compila).
Deps: `zod`. Dev: `typescript`, `vitest`. Scripts: `typecheck: tsc --noEmit`, `test: vitest run`.
`vitest.config.ts` con `environment: "node"`.

**2.1 `src/dominio/dinero.ts`** (+ `dinero.test.ts`)
- `type Centavos = number & { readonly __marca: "Centavos" }` (vía `z.number().int().brand<"Centavos">()`).
- `esquemaCentavos` (entero ≥ 0, `Number.isSafeInteger`) y `esquemaCentavosConSigno` (entero, para
  `diferencia_centavos`).
- `centavos(n: number): Centavos` — lanza si no es entero seguro. `centavosDesdePesos(pesos: number)`
  — exige pesos enteros, devuelve `pesos * 100`. `sumarCentavos(lista: readonly Centavos[]): Centavos`.
- **No** incluye formato visual (eso es `use-formato-moneda` en web) ni cálculo de comisión (H-03).
- Tests: rechaza `0.5`, `NaN`, `"30000"`, no seguros; `centavosDesdePesos(30000) === 3_000_000`; suma.

**2.2 `src/dominio/porcentaje.ts`**: `esquemaPorcentajeBase10000` (entero 0..10000; `5000` = 50,00 %).

**2.3 `src/dominio/dia-operativo.ts`** (+ test) — **la única función de día operativo** (regla 5, D-12).
```ts
export type DiaOperativo = string & { readonly __marca: "DiaOperativo" }; // "YYYY-MM-DD"
export interface ConfigDiaOperativo {
  readonly zona_horaria: string; readonly hora_apertura: number; readonly hora_cierre: number;
}
export function calcularDiaOperativo(
  instante: Date, config: ConfigDiaOperativo,
): { readonly dia: DiaOperativo; readonly fueraDeHorario: boolean };
```
- Regla: `dia` = fecha calendario **en la zona del negocio**. Antes de apertura → hoy (doc).
  Después del cierre → hoy + `fueraDeHorario: true` (`// P-F: se asume aceptar al día actual`).
- Implementación con `Intl.DateTimeFormat(...).formatToParts` (sin `date-fns-tz`; ver DM en registro).
- Valida `config` (zona IANA válida, 0 ≤ apertura < cierre ≤ 24) y lanza `Error` en español si no.
- Tests obligatorios: 10:00 Bogotá → mismo día; 07:00 → mismo día, `fueraDeHorario` true;
  17:15 → mismo día, true; **23:30 Bogotá (04:30Z del día siguiente) → fecha de Bogotá, no UTC**;
  00:00 exacto; zona inválida lanza; apertura ≥ cierre lanza.
- También exporta `esquemaDiaOperativo` (regex + fecha real válida) desde aquí o desde `esquemas/comun.ts`.

**2.4 `src/esquemas/*.ts`** — un archivo por dominio, **1:1 con `docs/modelo-datos.md`**:
`comun.ts` (id, fecha-hora ISO UTC, día operativo), `negocio.ts`, `usuarios.ts`, `trabajadores.ts`
(Trabajador, AcuerdoComision), `catalogo.ts` (RangoCilindraje, TipoServicio, Servicio, Precio),
`vehiculos.ts`, `ordenes.ts` (EstadoOrden, Orden, ItemOrden, MetodoPago, Pago, TipoEventoOrden,
EventoOrden), `cierre-caja.ts`.
Reglas de traducción Prisma → Zod:
- Campos en `snake_case` idénticos al schema. `DateTime` → string ISO 8601 UTC. `@db.Date` →
  `DiaOperativo`. `Int` de dinero → `esquemaCentavos`. Porcentajes → `esquemaPorcentajeBase10000`.
- `String?` → `.nullable()` (no `.optional()`: Prisma devuelve `null`).
- Enums: `export const ESTADOS_ORDEN = ["CREADA", ...] as const;` + `z.enum(ESTADOS_ORDEN)` +
  `type EstadoOrden = (typeof ESTADOS_ORDEN)[number]`. Sin `enum` de TS.
- Ids: `z.string().min(1)` (no `z.uuid()`; ver E-002 en `errores.md`).
- Sin relaciones embebidas (los DTO compuestos se agregan por rebanada). **Sin** `Sesion` ni
  `password_hash` (esquema de salida `UsuarioPublico`).
- Reglas del modelo como `superRefine`: `es_cortesia` ⇒ `motivo_cortesia` no vacío;
  `estado === "ANULADA"` ⇒ `motivo_anulacion` no vacío; `cc_max === null || cc_max >= cc_min`;
  `diferencia_centavos === reportado - esperado`.
- Tipos derivados: `type Orden = z.infer<typeof esquemaOrden>`.
- `porcentaje_comision_congelado` queda **no nulo** como en Prisma (ver H-01). Nada de
  `descuento_centavos` todavía (ver H-06).
- Tests (`esquemas/*.test.ts`): un fixture válido por entidad parsea; rechaza dinero decimal o string;
  cada `superRefine` tiene caso positivo y negativo; campos extra se descartan (strip).

### Paso 3 — `apps/web` (andamio a mano, sin `create-vue` interactivo)
`package.json`: `name: "@lavado-vehicular/web"`, `type: "module"`, `private: true`.
Scripts: `dev: vite`, `build: vue-tsc -b && vite build`, `preview: vite preview`,
`typecheck: vue-tsc --noEmit -p tsconfig.app.json` (ajustar a la forma que pida la versión),
`test: vitest run`, `e2e: playwright test`.

Dependencias (instalar **todas** ahora):
- Prod: `vue`, `vue-router`, `pinia`, `primevue`, `@primeuix/themes` (o el paquete de temas que
  indique la doc de PrimeVue instalada), `primeicons`, `zod`, `@sentry/vue`,
  `@lavado-vehicular/shared` (`workspace:*`).
- Dev: `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`, `tailwindcss`, `@tailwindcss/vite`,
  `tailwindcss-primeui`, `vitest`, `jsdom`, `@vue/test-utils`, `@testing-library/vue`,
  `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`,
  `@axe-core/playwright`, `@types/node`.

Archivos:
- `index.html`: `lang="es"`, viewport, `<title>Lavado Vehicular</title>`. **Sin scripts inline**
  (compatibilidad con CSP estricta de F2, regla 18).
- `vite.config.ts`: plugins `vue()` + `tailwindcss()`, alias `@` → `src`, `envDir: "../.."`,
  `server: { port: 5173, strictPort: true }`.
- `vitest.config.ts` (merge del de Vite): `environment: "jsdom"`, `setupFiles: ["src/pruebas/setup.ts"]`.
- `src/pruebas/setup.ts`: `@testing-library/jest-dom/vitest`; stubs de `window.matchMedia` y
  `ResizeObserver` (PrimeVue los usa y jsdom no los trae).
- `tsconfig.json` (references) + `tsconfig.app.json` (extiende base, `types: ["vite/client"]`) +
  `tsconfig.node.json`. `src/env.d.ts` con `ImportMetaEnv` tipado (todas las `VITE_*`).
- `src/config/entorno.ts`: parsea `import.meta.env` con Zod (modos `"mock" | "http"`, tasa 0..1,
  latencias enteras); si falla, lanza error ruidoso en español al arrancar (regla 1 de seguridad).
  + test.
- `src/estilos/principal.css`: `@import "tailwindcss";` + plugin `tailwindcss-primeui` + bloque global
  `@media (prefers-reduced-motion: reduce)` que anula `animation`/`transition` (regla dura).
  Seguir la guía oficial PrimeVue + Tailwind v4 para el orden de `@layer` (utilidades ganan a PrimeVue).
- `src/observabilidad/sentry.ts`: `iniciarObservabilidad(app, router)`. Con `VITE_SENTRY_DSN` →
  `Sentry.init` real. **Sin DSN (modo consola, el de F1)** → `app.config.errorHandler`,
  `window.onerror` y `unhandledrejection` escriben `console.error("[observabilidad]", ...)` sin tragar
  el error. + test: sin DSN, un error de componente llega a `console.error`.
- `src/router/index.ts`: `createWebHistory`, una ruta `/` → `src/vistas/VistaInicio.vue` (placeholder
  con `<h1>Lavado Vehicular</h1>`). F1-1 la reemplaza.
- `src/main.ts`: `createApp(App)`, Pinia, router, PrimeVue con preset Aura (`darkModeSelector: ".app-oscuro"`),
  `ToastService`, `ConfirmationService`, `iniciarObservabilidad`.
- `src/App.vue`: `<RouterView />`. + `App.test.ts` (renderiza el h1, buscado por rol).

### Paso 4 — ESLint + Prettier (raíz)
- `prettier.config.js`: `printWidth: 100`, `semi: true`, `singleQuote: false`, `trailingComma: "all"`.
  `.prettierignore`: `pnpm-lock.yaml`, `dist`, `coverage`, reportes de Playwright.
- `eslint.config.js` (flat): `@eslint/js`, `typescript-eslint` con `strictTypeChecked` +
  `projectService`, `eslint-plugin-vue` (`flat/recommended`) vía `@vue/eslint-config-typescript`,
  `eslint-config-prettier` al final. (Instalar estas dev-deps en la raíz.)
- Reglas que materializan las convenciones (error, no warning):
  - `@typescript-eslint/no-floating-promises`, `no-explicit-any`, `ban-ts-comment`,
    `no-non-null-assertion` (se desactiva por línea con comentario que explique, como pide la convención).
  - `no-restricted-syntax`: `TSEnumDeclaration` (sin `enum`).
  - `vue/no-v-html` (regla 15 de seguridad).
  - `no-restricted-globals: fetch` en todo `apps/web/src` **excepto** `src/api/cliente.ts`.
  - `no-restricted-imports`: `@/mocks/*` prohibido fuera de `src/api/` y `src/mocks/`.
  - `vue/block-lang` → `script` con `lang="ts"`; `vue/component-api-style: ["script-setup"]`.
- Prueba de humo (y borrar después): un archivo temporal con `any`, `fetch` en una vista y una promesa
  sin `await` debe hacer fallar `pnpm lint`. Anotar resultado en el informe.

### Paso 5 — Playwright
- `apps/web/playwright.config.ts`: `testDir: "e2e"`, `webServer: { command: "pnpm dev", port: 5173,
  reuseExistingServer: !process.env.CI, env: { VITE_MOCK_ERROR_RATE: "0" } }`, `baseURL`,
  un proyecto `chromium` (F1-1 agrega los de anchura/movimiento reducido), `trace: "on-first-retry"`.
- `e2e/fixtures.ts`: fixture `test` que **falla la prueba ante `console.error` o `pageerror`**.
- `e2e/fp-0-arranque.spec.ts`: abre `/`, ve el h1, sin errores de consola.

### Paso 6 — Verificación
1. `rm -rf node_modules && pnpm install` limpio, sin warnings ignorados sin registrar.
2. `pnpm verificar` verde. `pnpm e2e` verde.
3. `pnpm dev` y abrir en navegador a 375, 768 y 1280 px (Playwright MCP o devtools): carga, sin scroll
   horizontal, sin errores de consola. Con `prefers-reduced-motion: reduce` no rompe nada.
4. Comprobar que `.env` no está trackeado (`git check-ignore .env`).

### Paso 7 — Cierre
- Actualizar `docs/registro/progreso.md`, `decisiones-tomadas.md` (versiones mayores instaladas) y
  `errores.md` (todo error encontrado y su solución).
- Commits atómicos (`chore(monorepo): ...`, `feat(shared): ...`, `chore(web): ...`).
- Informe de cierre ≤ 30 líneas (formato de `docs/metodologia.md`).

## Criterio de aceptación
- [ ] `pnpm install` limpio; `pnpm verificar` y `pnpm e2e` verdes.
- [ ] `packages/shared` exporta esquemas Zod de las 12 entidades públicas del modelo, `dinero.ts`,
      `porcentaje.ts` y `dia-operativo.ts`, con tests (incluido el caso de borde de zona horaria).
- [ ] `apps/web` importa `@lavado-vehicular/shared/esquemas/ordenes` y tipa sin errores.
- [ ] ESLint bloquea `any`, `enum`, `v-html`, `fetch` fuera de `api/cliente.ts`, promesas flotantes.
- [ ] Sentry en modo consola probado por test.
- [ ] Todas las dependencias de F1-1 instaladas.
- [ ] Pendiente registrado (H-04): gitleaks, Dependabot, CI remoto, `pnpm audit`.
