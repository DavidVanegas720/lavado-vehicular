# Progreso

Estados: `pendiente` · `en curso` · `bloqueado (motivo)` · `hecho (fecha)`.
"Hecho" exige: tests + E2E verdes **y** verificación en navegador (375 / 768 / 1280 px, claro/oscuro,
`prefers-reduced-motion`) registrada abajo. Commiteado no es hecho.

## Resumen

| Tarea | Plan | Estado | Rama | Notas |
|---|---|---|---|---|
| FP-0 Bootstrap monorepo | `.plan/FP-0.md` | hecho (2026-10-07; ver H-09) | `tarea/fp-0-bootstrap` | Autorizado por David (D-28) |
| F1-1 Fundación y componentes | `.plan/F1-1.md` | pendiente | `tarea/f1-1-fundacion` | Requiere FP-0 |
| F1-2 Autenticación mockeada | — | pendiente | — | Plan a redactar al cerrar F1-1 |
| Deuda A | — | pendiente | — | Tras F1-2 (incluye E-001, E-002, E-003, E-006) |
| F1-3 Operación diaria | — | pendiente | — | Antes: resolver H-01, H-03; revisar H-06 |
| F1-4 Catálogo y gestión | — | pendiente | — | Antes: H-07 |
| Deuda B | — | pendiente | — | Tras F1-4 |
| F1-5 Reportes y cierre | — | pendiente | — | Antes: H-08 |

## FP-0

- [x] P0 Commit de docs en `main` + rama
- [x] P1 Raíz (package.json, workspace, tsconfig base, .gitignore, .env.example)
- [x] P2 `packages/shared`: dinero, porcentaje, día operativo, esquemas Zod + tests
- [x] P3 `apps/web`: Vite + Vue + Pinia + Router + PrimeVue + Tailwind + entorno + Sentry consola
- [x] P4 ESLint + Prettier con reglas de convención (prueba de humo hecha)
- [x] P5 Playwright + E2E de arranque
- [x] P6 Verificación (`pnpm verificar`, `pnpm e2e`, navegador 3 anchuras)
- [x] P7 Registro + informe de cierre
- Pendiente diferido: gitleaks, Dependabot, CI remoto, `pnpm audit` → H-04

## F1-1

- [ ] Ola 0 · P0 preparación
- [ ] Ola 1 · P1-A tema · P1-B composables dominio · P1-C seed · P1-D cliente HTTP
- [ ] Ola 2 · P2-A layout/router · P2-B presentación · P2-C entradas · P2-D manejadores mock
- [ ] Ola 3 · P3-A formulario · P3-B tabla · P3-C tarjeta orden · P3-D diálogos/notificaciones · P3-E rango fechas
- [ ] Ola 4 · P4-A vistas conectadas · P4-B galería
- [ ] Ola 5 · P5-A E2E + axe · P5-B verificación navegador · P5-C cierre

### Verificación en navegador F1-1

| Vista | 375 | 768 | 1280 | Oscuro | Mov. reducido |
|---|---|---|---|---|---|
| Tablero | | | | | |
| Catálogo | | | | | |
| Reportes | | | | | |
| Galería | | | | | |
| 404 | | | | | |

## F1-2 · F1-3 · F1-4 · F1-5

Se detallan cuando su plan esté aprobado. Alcance en `docs/rebanadas.md`.
