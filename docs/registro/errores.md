# Bitácora de errores

Errores encontrados durante la construcción y cómo se resolvieron. Incluye inconsistencias de
documentación. Lo que necesita decisión de David va a `docs/pendientes.md` (H-XX), no acá.

## Plantilla

```markdown
### E-XXX — <título de una línea>
**Fecha / tarea:** 2026-10-07 · F1-1/P2-C
**Síntoma:** qué se vio (mensaje de error literal si lo hay).
**Causa:** por qué pasó.
**Solución:** qué se cambió (archivo/comando).
**Prevención:** regla o test que evita que se repita (o "ninguna").
**Estado:** resuelto / abierto / derivado a H-XX.
```

---

## Entradas

### E-001 — Glosario dice "base-100" para la comisión, pero el modelo usa base 10000
**Fecha / tarea:** 2026-10-07 · revisión de docs (arquitecto)
**Síntoma:** `glosario.md` → "enteros base-100 (`5000` = 50.00%)"; `modelo-datos.md` → `0..10000`.
**Causa:** redacción; el ejemplo es correcto, la palabra no.
**Solución:** el código usa `esquemaPorcentajeBase10000` (FP-0 paso 2.2). Corregir la palabra en el
glosario cuando David apruebe tocar docs.
**Estado:** abierto (cambio de una palabra).

### E-002 — `modelo-datos.md` llama UUID a `cuid()`
**Fecha / tarea:** 2026-10-07 · revisión de docs
**Síntoma:** principio 2: "Todo `id` es UUID (`cuid()` de Prisma)". Un cuid no es un UUID.
**Causa:** redacción.
**Solución:** esquemas Zod validan ids como `z.string().min(1)`, no `z.uuid()`; mocks generan ids
estables tipo cuid. Lo importante (no autoincremental) se cumple.
**Estado:** resuelto en el plan; corregir redacción del doc cuando se apruebe.

### E-003 — Nomenclatura vieja (P-1, P-3, R1, R2, R4, R6) en seguridad.md y decisiones.md
**Fecha / tarea:** 2026-10-07 · revisión de docs
**Síntoma:** `seguridad.md` y D-21/D-24 y "Decisiones pendientes" de `decisiones.md` usan P-1/P-3/R1..R6;
`rebanadas.md` usa FP-0, FP-F2-1..3, F1-x, F2-x. Las P-A..P-G de `decisiones.md` dicen "bloquea R2/R4"
mientras `pendientes.md` dice F2-3/F2-5.
**Solución (equivalencia a usar):** P-1 → FP-0 (parte web) + FP-F2-1 (parte api); P-3 → FP-F2-3;
R1 → F2-1. Para bloqueos de P-X manda `pendientes.md`.
**Estado:** abierto (tarea de docs en deuda A).

### E-004 — `rebanadas.md` pide CI, Dependabot y gitleaks en FP-0; David los difirió
**Fecha / tarea:** 2026-10-07 · planificación FP-0
**Solución:** FP-0 deja scripts locales (`pnpm verificar`) y difiere lo remoto → H-04.
**Estado:** derivado a H-04.

### E-005 — Convención "archivos kebab-case" choca con componentes `.vue`
**Fecha / tarea:** 2026-10-07 · planificación F1-1
**Síntoma:** `convenciones-codigo.md` exige kebab-case en archivos, pero su propio ejemplo usa
`BotonPrincipal.vue` / `BotonPrincipal.test.ts`.
**Solución:** `.vue` y sus tests en PascalCase (convención Vue + ejemplo del doc); todo lo demás
kebab-case (`use-tema.ts`). Registrado como DM-07.
**Estado:** resuelto.

### E-006 — `arquitectura.md` no lista `dia-operativo.ts` en `packages/shared/src/dominio/`
**Fecha / tarea:** 2026-10-07 · revisión de docs
**Síntoma:** el árbol dice "dominio/ (comisión, redondeo)"; D-12 y reglas-negocio fijan ahí el día operativo.
**Solución:** manda D-12. FP-0 lo crea en `packages/shared/src/dominio/dia-operativo.ts`.
**Estado:** resuelto en el plan; actualizar el árbol del doc.

### E-007 — Renombres de docs sin commitear en `main`
**Fecha / tarea:** 2026-10-07 · planificación FP-0
**Síntoma:** `git status` muestra `R arquitectura.md -> docs/arquitectura.md` etc. en staging.
**Solución:** FP-0 paso 0 commitea en `main` antes de abrir la rama de tarea.
**Estado:** resuelto (2026-10-07, commit `docs: mover documentos a docs/...` en `main`).

### E-008 — `pnpm add` con `@lavado-vehicular/shared@workspace:*` falla en zsh
**Fecha / tarea:** 2026-10-07 · FP-0/P3
**Síntoma:** `(eval):18: no matches found: @lavado-vehicular/shared@workspace:*`; el resto de la línea no se instaló.
**Causa:** zsh interpreta `*` como glob.
**Solución:** entrecomillar: `pnpm add '@lavado-vehicular/shared@workspace:*'`.
**Prevención:** entrecomillar specs con `*` en comandos de shell.
**Estado:** resuelto.

### E-009 — `esquemaDiaOperativo` lanzaba excepción con texto mal formado
**Fecha / tarea:** 2026-10-07 · FP-0/P2.3
**Síntoma:** test `safeParse("07/10/2026")` lanzaba `RangeError: Invalid time value` en vez de devolver `success: false`.
**Causa:** Zod 4 ejecuta los `refine` aunque el `regex` previo falle; `toISOString()` sobre una fecha NaN lanza.
**Solución:** el refine comprueba `!Number.isNaN(fecha.getTime())` antes de `toISOString()` (`dia-operativo.ts`).
**Prevención:** test "acepta una fecha real y rechaza una inexistente o mal formada".
**Estado:** resuelto.

### E-010 — TypeScript 7 (latest) rompe `vue-tsc` y no lo soporta `typescript-eslint`
**Fecha / tarea:** 2026-10-07 · FP-0/P3
**Síntoma:** `pnpm typecheck` -> `ERR_PACKAGE_PATH_NOT_EXPORTED` en `vue-tsc/index.js` (`resolveTscPath`).
`typescript-eslint@8.71` declara peer `typescript >=4.8.4 <6.1.0`.
**Causa:** `latest` de `typescript` es 7.0.x (compilador nativo, sin `lib/tsc.js`); vue-tsc 3.3 usa esa ruta.
**Solución:** fijar `typescript@~6.0.3` (raíz, `apps/web`, `packages/shared`). Registrado en DM-20.
**Prevención:** subir a TS 7 solo cuando vue-tsc y typescript-eslint lo soporten.
**Estado:** resuelto.

### E-011 — `vitest.config.ts` importaba `./vite.config` sin extensión (aviso de Vite 8)
**Fecha / tarea:** 2026-10-07 · FP-0/P3
**Síntoma:** `(!) Your Vite config uses features that are unsupported by configLoader: 'native'... import "./vite.config" without a file extension`.
**Solución:** `import ... from "./vite.config.ts"` + `allowImportingTsExtensions` en `tsconfig.node.json`.
**Estado:** resuelto.

### E-012 — `pnpm format` reescribió los .md de docs/ y .plan/
**Fecha / tarea:** 2026-10-07 · FP-0/P4
**Síntoma:** `git status` mostró ~15 documentos modificados tras `pnpm format`.
**Causa:** Prettier formatea Markdown por defecto (tablas, énfasis).
**Solución:** `git checkout -- docs .plan` y agregar `docs`, `.plan`, `CLAUDE.md`, `PROMPT-INICIAL.md` a `.prettierignore` (DM-19).
**Estado:** resuelto.

### E-013 — Artefactos `*.tsbuildinfo` de `vue-tsc -b` aparecían sin ignorar
**Fecha / tarea:** 2026-10-07 · FP-0/P3
**Solución:** `*.tsbuildinfo` agregado a `.gitignore`.
**Estado:** resuelto.

### E-014 — PrimeVue 5 es una librería con licencia y avisa "license is not configured"
**Fecha / tarea:** 2026-10-07 · FP-0/P5
**Síntoma:** `console.warn [PrimeUI] PrimeUI license is not configured.` al arrancar (solo warning; el fixture E2E falla solo ante `console.error`).
**Causa:** `primevue@5` (última estable) usa `@primeui/license-manager`: licencia comunitaria gratuita (<US$1M ingresos, <5 devs, etc.) que exige clave y renovación anual; sin clave muestra aviso.
**Solución:** ninguna todavía; queda como decisión de David (H-09). Alternativa: fijar `primevue@^4` (MIT).
**Estado:** derivado a H-09.

### E-015 — El plan dice que 2026-10-07 es "martes"; es miércoles
**Fecha / tarea:** 2026-10-07 · F1-1/P1-B
**Síntoma:** `formatearDia("2026-10-07")` devuelve `"miércoles, 7 de octubre de 2026"`, no `"martes, ..."` como dice `.plan/F1-1.md`.
**Causa:** error de calendario en el plan; `Intl` es correcto.
**Solución:** el test espera "miércoles". Corregir el ejemplo del plan (no tocado por P1-B).
**Estado:** resuelto.

### E-P2C — Tests de componentes: sin limpieza automática ni `matchMedia` global
**Fecha / tarea:** 2026-10-07 · F1-1/P2-C
**Síntoma:** `getByLabelText` encontraba elementos de tests anteriores; `PrimeVue Select` lanzaba `matchMedia is not a function`; `InputText` exigía el plugin PrimeVue.
**Causa:** vitest sin `globals` no registra el `cleanup` de testing-library, y el stub de `matchMedia` de `pruebas/setup.ts` está en `window` pero PrimeVue llama al global.
**Solución:** cada test hace `afterEach(cleanup)` y los de `Select` usan `vi.stubGlobal("matchMedia", ...)`. Sugerencia para el orquestador: mover ambos a `src/pruebas/setup.ts`.
**Estado:** resuelto (workaround local).

## E-OLA2 — Cierre de la Ola 2 de F1-1 (orquestador)
- **Formato:** 4 archivos de P2-A fallaban `prettier --check`; se corrigió con `prettier --write` antes del commit.
- **Warnings abiertos (10):** `vue/require-default-prop` en props opcionales (`icono`, `ariaLabel`, `descripcion`). No son errores; en Vue 3.5 + TS una prop opcional ya es `undefined` por defecto. Decidir en la Ola 3 si se desactiva la regla en `eslint.config.js` o se añaden defaults.
- **Setup de pruebas (P2-B y P2-C):** `src/pruebas/setup.ts` no hace `cleanup` entre tests ni expone `matchMedia` al global de PrimeVue `Select`. Cada agente lo parchó en sus tests; mover a `setup.ts` (archivo de FP-0) como limpieza pendiente.
- **Mocks en bundle http (P2-D):** `import "../mocks"` en `src/api/*.ts` mete los mocks en el bundle aunque el modo sea http. Revisar en F2.
- **Plan F1-1:** el ejemplo del plan dice que 2026-10-07 es martes; es miércoles (E-015).

## E-OLA3 — Cierre de la Ola 3 de F1-1 (orquestador)
- **Typecheck en tests (P3-B, P3-E):** `SelectorRangoFechas.test.ts` pasaba strings donde se espera el tipo marcado `DiaOperativo`; `TablaBase.test.ts` fallaba porque el componente es genérico (`T`) y `render` no puede inferirlo (`claveFila` quedaba como `never`). Solución: helper `dia()` con cast en el test de fechas (import desde `@lavado-vehicular/shared/dominio/dia-operativo`, el paquete no tiene export raíz) y cast del componente genérico a `Component` en el test de la tabla. Código de producción sin cambios.
- **Lint:** al quitar los `?.` innecesarios, `textContent` es `string` en jsdom/DOM types; el `[0]` sí puede ser `undefined` (noUncheckedIndexedAccess).
- **Warnings abiertos (11):** `vue/require-default-prop` (ver E-OLA2).
- **matchMedia en Notificaciones (P3-D):** el agente añadió un guard `window.matchMedia` en `Notificaciones.vue` porque en su test no existía pese al stub de `setup.ts`. Causa no investigada; revisar si el guard sigue haciendo falta.
- **Fuera de alcance de los pasos:** TablaBase asume zona America/Bogota en `fecha-hora` (P-X); TarjetaOrden asume paquete = primer ítem por `created_at`; SelectorRangoFechas asume semana lunes–domingo (H-08).

## E-P4A — `setup.ts` no stubeaba `matchMedia`
- **Síntoma:** `window.matchMedia is not a function` al montar `TablaBase` en tests de vistas/App.
- **Causa:** jsdom define `window.matchMedia` como propiedad con valor `undefined`, así que `!("matchMedia" in window)` era falso y el stub nunca se instalaba (explica el guard de P3-D en `Notificaciones`).
- **Solución:** `src/pruebas/setup.ts` ahora usa `typeof window.matchMedia !== "function"`. Efecto: en tests la barra lateral arranca colapsada (matches=false); `App.test.ts` usa nombre accesible.
- **Estado:** resuelto.

## E-OLA4 — Cierre de la Ola 4 de F1-1 (orquestador)
- **Causa raíz de E-OLA3 (matchMedia):** mi stub de `setup.ts` (commit 712103b) usaba `"matchMedia" in window`, que es verdadero en jsdom aunque valga `undefined`. P4-A lo corrigió con `typeof window.matchMedia !== "function"` (E-P4A). El guard `window.matchMedia` que P3-D metió en `Notificaciones.vue` ya no debería hacer falta: quitarlo en la limpieza de F1-1.
- **Build:** aviso de chunk > 500 kB tras minificar (PrimeVue + galería). No bloquea. Revisar code-splitting de la ruta `/componentes` (solo DEV) antes de F2.
- **Warnings abiertos (11):** `vue/require-default-prop` sin cambios.
- **Vistas:** el día en Tablero/Reportes usa Bogotá 8–17 hasta que exista la config del negocio (H-07).
