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
**Estado:** abierto hasta ejecutar FP-0.
