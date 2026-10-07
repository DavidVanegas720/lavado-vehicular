# Decisiones menores de construcción

Decisiones técnicas chicas tomadas durante la construcción. No cambian ninguna D-XX ni reglas de
negocio; si una lo hiciera, va a `docs/decisiones.md` con aprobación de David.
Las DM-01..DM-16 las propuso el arquitecto al planificar FP-0/F1-1: **vigentes salvo objeción de David**.

## Plantilla

```markdown
### DM-XX — <título>
**Fecha / tarea:** 2026-10-07 · F1-1/P1-A
**Decidido:** una o dos líneas.
**Por qué:** una línea.
**Alternativa descartada:** una línea (opcional).
```

---

### DM-01 — `packages/shared` se consume como fuente TS, sin build
**Fecha / tarea:** 2026-10-07 · FP-0 · `exports` apuntan a `src/*.ts`. **Por qué:** D-05 "sin doble build";
Vite y Vitest compilan TS directo. F2 decide si el backend necesita compilarlo.

### DM-02 — JSON de API y mocks en `snake_case`, idéntico al modelo
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** Prisma devuelve así los campos; cero capa de
traducción y el mock = respuesta real de F2. **Descartado:** camelCase en el borde HTTP.

### DM-03 — `DiaOperativo` es string `YYYY-MM-DD` con marca de tipo; fechas-hora son ISO UTC
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** `@db.Date` no tiene hora; un `Date` de JS
reintroduce la zona y es la fuente clásica de errores de día.

### DM-04 — Día operativo con `Intl.DateTimeFormat`, sin `date-fns-tz`
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** la convención permite `date-fns-tz` "cuando haga
falta"; `Intl` resuelve la conversión de zona sin dependencia. Se agrega la librería si aparece un caso.

### DM-05 — Dinero con tipo marcado `Centavos` (Zod `.brand`)
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** TS impide pasar un número cualquiera (pesos) donde
se esperan centavos. Regla 1 reforzada por el compilador.

### DM-06 — Prettier: 100 columnas, comillas dobles, `;`, coma final
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** 100 lo fija la convención; el resto coincide con
los ejemplos de los docs.

### DM-07 — `.vue` en PascalCase, resto de archivos en kebab-case
**Fecha / tarea:** 2026-10-07 · F1-1 · Ver E-005.

### DM-08 — Tema en composable de módulo (`useTema`), no en Pinia
**Fecha / tarea:** 2026-10-07 · F1-1 · **Por qué:** arquitectura limita Pinia a estado global de dominio
(sesión, arranque en frío, negocio suspendido). Persistencia en `localStorage` con `try/catch`.

### DM-09 — Tema inicial aplicado en `main.ts` antes de montar, sin script inline
**Fecha / tarea:** 2026-10-07 · F1-1 · **Por qué:** un script inline en `index.html` rompe la CSP
`default-src 'self'` de F2 (regla 18). Costo: posible destello mínimo.

### DM-10 — Seed relativo a un reloj; E2E fijan la hora con `page.clock`
**Fecha / tarea:** 2026-10-07 · F1-1 · `crearSeed(ahora)` es puro y determinista para un `ahora` dado;
dev usa la hora real ("día operativo actual"), E2E usan `2026-10-07T15:00-05:00`. PRNG mulberry32,
prohibido `Math.random` en mocks. **Por qué:** concilia "semilla determinista" con "órdenes de hoy".

### DM-11 — `EntradaDinero`: el usuario escribe pesos enteros; se emiten centavos
**Fecha / tarea:** 2026-10-07 · F1-1 · **Por qué:** en COP no se manejan centavos en caja; el formato
muestra decimales solo si el monto no es múltiplo de 100 (p. ej. comisiones).

### DM-12 — Mocks enrutados por `"MÉTODO /api/ruta"`; modo `http` es un stub en F1
**Fecha / tarea:** 2026-10-07 · F1-1 · **Por qué:** la vista arma la misma `Peticion` que en F2; cambiar
de modo no toca vistas. El `fetch` real llega en F2 (no se adelanta alcance).

### DM-13 — Selectores de dominio reciben opciones por props; no piden datos
**Fecha / tarea:** 2026-10-07 · F1-1 · **Por qué:** componentes puros y testeables; la vista pide al cliente.

### DM-14 — Galería de componentes en `/componentes`, solo con `import.meta.env.DEV`
**Fecha / tarea:** 2026-10-07 · F1-1 · **Por qué:** la E2E de F1-1 necesita ver los componentes
renderizados; no debe existir en un build de producción.

### DM-15 — Accesibilidad verificada con `@axe-core/playwright` en la E2E
**Fecha / tarea:** 2026-10-07 · F1-1 · **Por qué:** el objetivo WCAG AA (contraste incluido) no se
puede verificar a ojo de forma confiable. Caso concreto, no "por si acaso".

### DM-16 — Entorno de pruebas: Vitest por paquete, `jsdom` en web, Playwright solo Chromium
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** lo más simple que cubre el caso; los proyectos de
Playwright varían anchura, tema y movimiento reducido, no navegador.

### DM-17 — Node 24 aceptado como runtime (`engines.node >=24`)
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** Node 20 está fuera de soporte (H-02); David aceptó
Node 24 para FP-0. La enmienda formal de D-01 sigue en H-02.

### DM-18 — `.plan/` se versiona en git
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** los agentes y el revisor necesitan el plan en el repo
(H-05); David lo aceptó. La confirmación formal sigue en H-05.

### DM-19 — Prettier ignora la documentación redactada a mano
**Fecha / tarea:** 2026-10-07 · FP-0 · `docs/`, `.plan/`, `CLAUDE.md`, `PROMPT-INICIAL.md` en `.prettierignore`.
**Por qué:** formatearlos reescribe tablas y diluye los diffs de docs (E-012).

### DM-20 — TypeScript fijado en `~6.0.3`
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** TS 7 rompe `vue-tsc` y excede el peer de `typescript-eslint` (E-010).

### DM-21 — Un solo archivo de pruebas de esquemas con fixtures compartidos
**Fecha / tarea:** 2026-10-07 · FP-0 · `esquemas/esquemas.test.ts` + `fixtures.ts` en vez de un test por archivo.
**Por qué:** los 13 esquemas comparten fixtures; menos duplicación. Cubre todos los casos pedidos.

### DM-22 — Se modelan 13 esquemas (el plan dice "12 entidades")
**Fecha / tarea:** 2026-10-07 · FP-0 · **Por qué:** el modelo tiene 14 `model` menos `Sesion` = 13 (incl. `Negocio`).

---

## Versiones instaladas

Instaladas el 2026-10-07 con Node v24.20.0 y pnpm 12.9.1:

| Paquete | Versión |
|---|---|
| vue | 3.5 (vue-router 5, pinia 4) |
| vite | 8.3 (@vitejs/plugin-vue 6) |
| primevue | 5.0 (@primeuix/themes 3.0; ver H-09 por licencia) |
| tailwindcss | 4.3 (+ tailwindcss-primeui 0.6) |
| zod | 4.6 |
| vitest | 5.0 (jsdom 30, @testing-library/vue 8) |
| @playwright/test | 1.63 (@axe-core/playwright 4.13) |
| typescript | 6.0.3 (fijado, DM-20; latest es 7.0) |
| eslint | 10.12 (typescript-eslint 8.71, eslint-plugin-vue 10) |
| prettier | 3.9 |
| @sentry/vue | 11.4 |

## DM-23 — PrimeVue fijado en ^4 (MIT), no 5 (H-09)
PrimeVue 5 exige clave de licencia y emite `console.warn` sin ella; choca con la capa gratuita (D-21) y con la fixture E2E que falla ante errores de consola. Se fija `primevue@^4.5.5` + `@primeuix/themes@^2.0.3`. Verificado: verificar, build y e2e pasan. Revisitar si PrimeVue 4 deja de recibir parches.

## DM-P1A — Tokens con `@theme static` y override en `.app-oscuro`
Los tokens viven en `src/estilos/tokens.css` como `@theme static` (emite en `:root` y genera utilidades Tailwind: `bg-fondo`, `text-estado-lavando`...). El modo oscuro redefine las mismas variables bajo `.app-oscuro`, sin duplicar utilidades. Primario del proyecto: azul (#1d4ed8 claro / #60a5fa oscuro). Preset en `src/tema/preset.ts` (`presetLavado` + `opcionesTema`); `main.ts` los consume. Colores contrastados a mano (AA), axe en P5-A.

## DM-24 — P1-B: formateo de dinero sin división y hora en 24 h
**Fecha / tarea:** 2026-10-07 · F1-1/P1-B. `formatear` pasa a `Intl.NumberFormat` un decimal exacto en texto (`"1234.56"`, armado con `slice` sobre los centavos) en vez de dividir (regla 1). `formatearHora` devuelve `HH:mm` 24 h en la zona del negocio (el plan no fijaba formato). `useDiaOperativo` es un `ref` de `ahora` con `setInterval` de 60 s limpiado en `onScopeDispose`.

## DM-24 — Cliente HTTP (P1-D): modo `negocio` sigue a `catalogo`; PRNG determinista; registro estricto
**Fecha / tarea:** 2026-10-07 · F1-1/P1-D
`entorno.ts` no tiene `VITE_API_MODO_NEGOCIO` (H-07), así que `modoDe("negocio")` usa el modo de `catalogo`. `ModuloApi` cubre los 7 módulos con variable de entorno + `negocio` (`salud` y `respaldo` no los consume el frontend). Latencia y errores simulados usan un PRNG mulberry32 con semilla fija (reproducible); los errores alternan `sin-respuesta`/`servidor`. `registrarManejador` lanza si la clave ya existe; `configurarClienteParaPruebas` acepta además `modo` para forzar `mock`/`http` en tests.

### F1-1/P1-C — Orden del seed y detalles de mocks
`crearSeed` genera las 20 órdenes en orden cronológico (anuladas primero, CREADA al final) para que la
orden de reemplazo sea posterior a la anulada cobrada. Inicio del día local calculado con offset fijo
`-05:00` (Bogotá no tiene horario de verano) y el día con `calcularDiaOperativo`. Cortesía: sin
`fecha_cobro` ni evento COBRADA. `esquemaResumenOrdenTablero` se define con `esquemaOrden.and(...)`
porque `esquemaOrden` lleva `superRefine` y no admite `.extend`. Semilla PRNG fija `20261007`.
