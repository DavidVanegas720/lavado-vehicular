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

### F1-1/P2-D — Registro de mocks por efecto de importación desde `src/api/*`
`src/mocks/index.ts` registra los 5 manejadores al evaluarse; cada `src/api/*.ts` hace `import "../mocks"` (los módulos ES se evalúan una sola vez, así no hay doble registro). `cliente.ts` (de P1-D) no se tocó. El tablero filtra por `orden.dia_operativo` y, sin `dia`, usa `calcularDiaOperativo(ahora(), negocio)`; un `dia` mal formado devuelve `servidor`. Consecuencia: en modo http los mocks también entran al bundle (aceptable en F1; revisar en F2).
**Estado:** resuelto.

### F1-1/P2-A — Layout y router: detalles
`src/router/index.ts` exporta `rutas` e `instalarGanchosNavegacion` (para tests con `createMemoryHistory`). El foco al `<h1>` se hace en `afterEach` (tras `nextTick`) y también en `@after-enter` de la `Transition` (con `mode="out-in"` el h1 nuevo aparece tras 250 ms); helper en `componentes/layout/foco.ts`. Las vistas llevan `<h1 tabindex="-1">`. `BarraSuperior` recibe además `menuAbierto` y emite `alternar-menu` (el plan solo decía `titulo`). La barra lateral lleva un botón propio para contraer/expandir; el estado inicial (tablet colapsada, desktop expandida) lo decide `LayoutPrincipal` con `matchMedia("(min-width: 1024px)")`. Se añade `declare module "vue-router"` con `meta.titulo`.

## DM-P2B — Componentes de presentación: botón nativo y tarjeta interactiva
**Fecha / tarea:** 2026-10-07 · F1-1/P2-B. `BotonBase` usa `<button>` nativo con Tailwind (no PrimeVue `Button`) para controlar `aria-busy`, ancho estable al cargar (etiqueta `invisible` + spinner absoluto) y bloqueo de `click`. Cargando usa `aria-disabled` (conserva foco); deshabilitado usa `disabled`. `TarjetaBase` interactiva toma `role="button"` + `tabindex=0` y emite `seleccionar` con clic/Enter/Espacio. Los tests llaman `afterEach(cleanup)` porque `setup.ts` no limpia solo (globals de vitest apagados).

## DM-P2C — Entradas con `<input>` nativo; selectores con PrimeVue `Select`
**Fecha / tarea:** 2026-10-07 · F1-1/P2-C
`EntradaTexto/Numero/Correo/Contrasena/Dinero` usan `<input>` nativo con clases de tokens Tailwind, no `InputText` de PrimeVue: `InputText` guarda su propio `d_value` y pisa el valor formateado/saneado que `EntradaDinero` y `EntradaNumero` escriben en vivo (se vería el texto crudo). `SelectorBase` sí envuelve `Select` (etiqueta vía `aria-labelledby`, descripción/requerido por `pt.label`). Detalles: `EntradaDinero` rechaza (no recorta) lo que excede `max`, 0 emite `null` salvo `permiteCero`, y sube a `min` al salir; `EntradaNumero` aplica `min`/`max` al salir. Los selectores de dominio conservan visible el ítem inactivo ya elegido (marcado "(inactivo)"). `SelectorTrabajador` con `permiteSinAsignar` emite `null` para "Sin asignar" (`// P-G`). Descripción de rango ("0 a 200 cc") es solo presentación.

## DM-P3E — SelectorRangoFechas con `<input type="date">` nativos
**Fecha / tarea:** 2026-10-07 · F1-1/P3-E
Dos `<input type="date">` (Desde/Hasta) dentro de un grupo etiquetado por `CampoBase`, más atajos Hoy / Esta semana / Este mes / Mes anterior. Solo emite cuando ambos extremos están completos (si no, `null`); si `desde > hasta` mueve el otro extremo en vez de rechazar; los valores superiores a `maximo` se recortan a `maximo`. Sin prop de configuración: el día actual usa `calcularDiaOperativo` con Bogotá 8–17 asumido (`// P-X`) hasta que exista configuración de negocio; "Esta semana" va de lunes a `min(domingo, maximo)` (`// H-08`). Aritmética de fechas en UTC sobre texto AAAA-MM-DD; ningún `Date` sale del componente.

## DM-P3C — `TarjetaOrden`: `<article>` propio, paquete = primer ítem, zona por prop
**Fecha / tarea:** 2026-10-07 · F1-1/P3-C
`TarjetaOrden` es un `<article tabindex=0>` propio (no `TarjetaBase`, cuyo rol `button` contradice el plan: debe ser `article` con nombre "Orden {placa}"); emite `seleccionar(id)` con clic/Enter, sin botones. `// P-TO1`: la hora local usa prop opcional `zonaHoraria` (por defecto `America/Bogota`, igual que el seed) porque el plan no pasa la config del negocio. `// P-TO2`: el "paquete" es el primer ítem por `created_at` y el resto cuenta como "+N adicionales" (el DTO no distingue paquete de adicional).

## DM-P3A — `useForm` recibe el esquema Zod; `FormularioBase` recibe el formulario por prop
**Fecha / tarea:** 2026-10-07 · F1-1/P3-A
`useForm(esquema, iniciales)` devuelve `{ valores, errores, id, alSalir, validar, reiniciar }`. `FormularioBase` toma además la prop `formulario` (el retorno de `useForm`, no listada en la tabla del plan) para validar al enviar sin duplicar estado. Los campos del slot enlazan `valores`, `errores` y `alSalir` (blur) y usan `formulario.id(campo)`. Foco al primer campo inválido: busca el primer `[aria-invalid="true"]` del `<form>` tras `nextTick`. Un error ya visible se corrige en vivo al escribir. Con `enviando` se ignora el envío.

### F1-1/P3-D — Diálogos y notificaciones sobre PrimeVue
`DialogoModal` envuelve `Dialog` (header = `titulo`, trampa de foco y Esc de PrimeVue); devuelve el foco al disparador con un `watch` sobre `visible`, y añade slot `pie`. `DialogoConfirmacion` siempre pone el foco inicial en Cancelar (atributo `autofocus`, no solo en peligroso) y bloquea el cierre mientras `cargando`. `Notificaciones` elige `top-center`/`top-right` con `matchMedia("(min-width: 768px)")` (tolera su ausencia); `useNotificacion` usa 3 s éxito, 6 s error, 4 s info/aviso, todas cerrables. El nombre `Notificaciones` incumple `vue/multi-word-component-names` (fijado por el plan): se desactiva la regla en ese archivo.

## DM-P3B — `TablaBase`: tabla nativa, vista móvil por `matchMedia`, selección por escuchador
**Fecha / tarea:** 2026-10-07 · F1-1/P3-B. Tabla nativa con Tailwind (no `DataTable` de PrimeVue) para controlar `aria-sort`, tarjetas móviles y tap targets. `< 768 px` se decide con `matchMedia("(min-width: 768px)")` (se renderiza una sola vista, no dos). Props añadidas al plan: `etiqueta` (nombre accesible) y `error` es booleano. Las filas solo son enfocables/seleccionables si el padre escucha `seleccionar-fila` (se detecta vía `vnode.props`). Formato `fecha-hora` asume zona `America/Bogota` (`// P-X`) porque la tabla no recibe la config del negocio. Orden alterna asc, desc, sin orden.

## DM-P4B — Galería: filas de precios con ids, selector de rango tipado localmente
**Fecha / tarea:** 2026-10-07 · F1-1/P4-B
`VistaGaleria` carga servicio/rango/precio/trabajador/tablero por `@/api/*` (sin literales de dinero; `EntradaDinero` parte de `null` y muestra el valor en centavos). La tabla de precios muestra ids de servicio/rango (sin cruzar nombres) para no inventar lógica. El tipo del `v-model` de `SelectorRangoFechas` se declara localmente (`{ desde: DiaOperativo; hasta: DiaOperativo }`): ESLint tipado no resuelve `RangoFechas` exportado desde un `.vue` (error `no-redundant-type-constituents`, también presente en `VistaReportes`, archivo de P4-A).

## DM-P4A — Vistas conectadas: día operativo con respaldo, catálogo plano, App.test ajustado
**Fecha / tarea:** 2026-10-07 · F1-1/P4-A. `VistaTablero` carga órdenes y negocio en paralelo; el día del encabezado sale de `useDiaOperativo` con la config del negocio y, mientras no llega (o si falla), Bogotá 8–17 (`// P-X`). Estado `null` = cargando; los cuatro estados no-ok de `Resultado` se mapean con `switch` exhaustivo a un mensaje y `EstadoVacio tono="error"` + Reintentar. `VistaCatalogo` aplana servicios + precios en una `TablaBase` con una columna por rango activo (orden `orden_visualizacion`); precio ausente muestra "—". `Notificaciones` se monta en `App.vue`. `App.test.ts` (no listado como propio) se ajustó: el h1 ahora es "Tablero del día" y el ítem activo se comprueba por nombre accesible (la barra puede estar colapsada). `VistaReportes` tipa el rango localmente (el tipo exportado del SFC no lo resuelve ESLint).
