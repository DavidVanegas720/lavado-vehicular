# Cierre de F1-1 — Fundación y componentes base

Fecha: 2026-10-07 · Rama `tarea/f1-1-fundacion` · Plan: `.plan/F1-1.md`

## Qué se entregó
- Layout (barra lateral colapsable + drawer móvil, barra superior), router, tema claro/oscuro persistente.
- Capa de mocks determinista (seed de 20 órdenes) detrás del cliente HTTP en modo `mock`.
- 25 componentes reutilizables con tests; composables de moneda, día operativo, tema, formulario y notificaciones.
- Vistas Tablero, Catálogo y Reportes conectadas al cliente; galería `/componentes` (solo DEV).
- E2E con Playwright en 5 proyectos (móvil, tablet, escritorio, mov. reducido, oscuro) con axe.

## Verificación
- `pnpm verificar`: 0 errores de lint (11 warnings), 42 tests en shared + 227 en web.
- `pnpm build` verde. `pnpm e2e`: 92 pasan, 8 omitidos por diseño.
- Navegador real (Chromium) a 375/768/1280, claro/oscuro, mov. reducido: tabla en `progreso.md`.

## Qué decidí y por qué
- PrimeVue 4 (MIT), no 5: la v5 pide licencia y choca con la capa gratuita (DM-23).
- Botones y entradas nativos; solo `Select`, `Dialog`, `Drawer`, `Toast` de PrimeVue (formato en vivo del dinero).
- El foco al h1 solo tras navegaciones posteriores a la carga inicial, para que el skip link sea el primer Tab (DM-P5A).
- `typecheck` cubre también `tsconfig.node.json`; antes un error de tipos en E2E rompía `build` sin romper `verificar`.

## Defectos que los E2E no veían (E-P5B)
Iconos sin CSS, tap targets de 40 px, toast desbordado en 375 px, botón de colapsar fuera de vista, 404 sin favicon.

## Qué quedó a medias
- Modal en móvil es hoja inferior (100vw), no altura completa: decisión de David.
- Tabla de la galería recorta una columna a 768 px; cabecera "Tipo" mide 43,5 px; `aria-label` "Close" del Drawer en inglés.
- 11 warnings `vue/require-default-prop`; chunk > 500 kB; mocks entran al bundle en modo http (revisar en F2).
- Sin gitleaks / Dependabot / CI remoto (H-04). Sin push al remoto.

## Antes de F1-3 (necesito a David)
H-01 (cuándo se congela el %), H-03 (redondeo de comisión). Revisar H-06, H-07, H-08.
