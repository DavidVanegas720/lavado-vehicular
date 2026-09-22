# Convenciones de código

Reglas concretas de estilo que todo chat de tarea sigue. Existen para que las revisiones de diff se concentren en el fondo, no en la forma.

Este documento no reemplaza a `arquitectura.md` (que define la estructura general) — la complementa con las decisiones granulares del día a día.

## Idioma

- **Dominio del negocio en español.** `Orden`, `Trabajador`, `RangoCilindraje`, `Servicio`, `Precio`, `cortesia`, `dia_operativo`. Los nombres del sistema deben coincidir con los que Carlos usa cuando habla del negocio.
- **Infraestructura y patrones en español.** `Repositorio`, `Servicio` (de código), `Controlador`, `Esquemas`. Mantiene la consistencia con la documentación.
- **Términos de librería en su idioma original.** `useState`, `defineComponent`, `PrismaClient`, `FastifyInstance`. No traducir.
- **Comentarios en español.** Salvo cuando refieren a código de librería.
- **Mensajes de error dirigidos al usuario, en español.** Sin excepciones.

## Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos | `kebab-case` | `crear-orden.ts`, `rango-cilindraje.repositorio.ts` |
| Tipos / interfaces / clases | `PascalCase` | `Orden`, `RepositorioOrdenes`, `EstadoOrden` |
| Variables / funciones | `camelCase` | `crearOrden()`, `diaOperativoActual` |
| Constantes globales | `SCREAMING_SNAKE_CASE` | `HORA_APERTURA_DEFAULT` |
| Campos de la base | `snake_case` | `porcentaje_comision_congelado`, `dia_operativo` |
| Rutas HTTP | `kebab-case` | `POST /api/ordenes`, `GET /api/cierre-caja` |

**Campos de dinero:** siempre sufijo `_centavos`. Sin excepciones. `precio_centavos`, `monto_centavos`, `total_esperado_centavos`. Ver `CLAUDE.md` regla 1.

**Campos congelados:** siempre sufijo `_congelado`. `porcentaje_comision_congelado`, `servicio_nombre_congelado`. Hace visible en el nombre lo que las órdenes viejas conservan. Ver `CLAUDE.md` regla 3.

## Estructura de un módulo del backend

Ya definida en `arquitectura.md`. Reforzando:

```
apps/api/src/modulos/<modulo>/
  rutas.ts           <- controlador
  servicio.ts        <- lógica de dominio
  repositorio.ts     <- consultas a Prisma
  esquemas.ts        <- Zod
  <modulo>.test.ts   <- pruebas de integración
```

- Un archivo `rutas.ts` por módulo, con las rutas del módulo como Fastify plugin.
- Un archivo `servicio.ts`. Si crece demasiado, se parte por caso de uso (`crear-orden.ts`, `cobrar-orden.ts`), no por capa. La partición horizontal está prohibida.
- Un archivo `repositorio.ts`. **Siempre extiende de `RepositorioBase`**, que aplica el filtro `negocio_id` en toda consulta. Ver más abajo.
- Los esquemas se re-exportan a `packages/shared` para que el frontend importe los tipos.

## Repositorio: filtro `negocio_id` automático

Todo repositorio del dominio extiende `RepositorioBase`, que toma el `contextoNegocio` de la petición y lo aplica en cada consulta:

```typescript
// apps/api/src/comun/repositorio-base.ts

export abstract class RepositorioBase {
  protected readonly negocioId: string;
  protected readonly prisma: PrismaClient;

  constructor(contexto: ContextoPeticion) {
    this.negocioId = contexto.negocioId;
    this.prisma = contexto.prisma;
  }

  // Los repositorios concretos usan this.negocioId en cada consulta.
  // Nunca se recibe negocioId como parámetro externo desde servicio o controlador.
}
```

**Regla:** ni el controlador ni el servicio reciben `negocioId` como parámetro. Lo tiene el contexto y solo el repositorio lo toca. Es la regla 4 de `CLAUDE.md` materializada.

## Errores

- **Errores de dominio:** clases propias que extienden `ErrorDominio`. Ejemplos: `OrdenNoExisteError`, `TrabajadorInactivoError`, `MontoInsuficienteError`.
- **Los lanza el servicio.** Nunca el controlador (el controlador no toma decisiones).
- **Los captura un middleware de Fastify** (`plugins/manejador-errores.ts`) que los mapea a estados HTTP (`404` para "no existe", `409` para "conflicto", `422` para "regla de negocio", `500` para el resto).
- **Sentry captura todo error no manejado** — no hay que llamar a Sentry a mano en cada endpoint.

Nunca `try/catch` que trague el error sin re-lanzar. Nunca `catch (e) { console.log(e) }`.

## Zod

- **Todo request y todo response validados por Zod.** Sin excepciones.
- Los esquemas viven en `apps/api/src/modulos/<modulo>/esquemas.ts` y se re-exportan a `packages/shared/src/esquemas/`.
- El frontend importa los tipos con `import type { CrearOrdenInput } from "@lavado-vehicular/shared/esquemas/ordenes"`.
- **Nunca esquemas inline en las rutas.** Van al archivo `esquemas.ts` del módulo.
- **Los tipos se derivan de los esquemas**, no al revés: `type CrearOrdenInput = z.infer<typeof esquemaCrearOrdenInput>`.

## TypeScript

- **`strict: true` sin excepciones.** Ni `any`, ni `@ts-ignore`, ni `!` sin comentario que explique por qué.
- **Uniones discriminadas** para resultados que pueden fallar de varias formas (típicamente el cliente HTTP del frontend).
- **`readonly` en interfaces de datos** que no deberían mutarse.
- **`unknown`, no `any`, para input externo antes de validar.**
- **Sin `enum` de TypeScript.** Usar `as const` + tipos derivados, o los enum de Prisma (que se generan como uniones de strings).

## Async / promesas

- **Siempre `async/await`.** Nunca `.then()` encadenado.
- **Errores fluyen por `throw`** — no hay callbacks de error.
- **Nunca promesa sin `await` sin una razón explícita comentada.** El linter (`no-floating-promises`) obliga a esto.
- **`Promise.all` para paralelismo** cuando dos operaciones no dependen entre sí.

## Fechas

- **En base y en API: siempre ISO 8601 en UTC.** `Orden.created_at`, `Pago.created_at`.
- **Día operativo:** columna `@db.Date` (sin hora), calculada por la función única de `packages/shared/src/dominio/dia-operativo.ts`. Nunca se calcula "a mano".
- **En el frontend:** se muestra en la zona horaria del negocio (`Negocio.zona_horaria`, default `America/Bogota`).
- **Librería:** `date-fns-tz` cuando haga falta conversión de zona. Prisma para el resto.

## Vue (frontend)

- **Todo componente en `<script setup lang="ts">`.** Sin Options API.
- **Pinia para estado global, `ref`/`reactive` locales para lo demás.**
- **Un composable existe cuando hay reutilización real o clara probabilidad.** No cada vista tiene el suyo por convención.
- **Las llamadas HTTP pasan siempre por `apps/web/src/api/cliente.ts`.** Ninguna vista llama a `fetch` directamente.
- **Los formularios usan `useForm` (un composable local), no manejo manual de refs por campo.**
- **PrimeVue para componentes de interfaz, Tailwind para layout.** Sin CSS custom salvo cuando el diseño lo obliga.

## Cliente HTTP en el frontend

Un único archivo (`apps/web/src/api/cliente.ts`) expone una función `pedir<T>()` que devuelve una unión discriminada:

```typescript
type Resultado<T> =
  | { estado: "ok"; datos: T }
  | { estado: "no-autenticado" }
  | { estado: "espera"; segundos: number }        // 429
  | { estado: "sin-respuesta" }                    // network / timeout
  | { estado: "servidor"; mensaje: string };       // 5xx / validación
```

Los componentes hacen `switch` sobre `resultado.estado` y TypeScript obliga a manejar cada caso. **Prohibido usar `try/catch` alrededor de `pedir()`** — el error ya viene tipado como parte del resultado.

## Pruebas

- **Archivo de prueba junto al fuente:** `crear-orden.ts` → `crear-orden.test.ts`.
- **Unitarias (Vitest):** funciones puras, sin base, sin red. Milisegundos.
- **Integración (Vitest + Docker Postgres):** servicio + repositorio contra base real. Cada prueba limpia lo suyo. Segundos.
- **E2E (Playwright):** en `apps/web/e2e/`, un archivo por rebanada. Levanta backend + frontend + base y ejerce el flujo desde el navegador. Al menos una prueba E2E por rebanada.
- **Los nombres de prueba en español, descriptivos:** `describe("crear orden", () => it("congela el porcentaje de comisión al crearse", ...))`.
- **Sin snapshots.** Son frágiles y no revelan intención.
- **Sin mocks de la base.** Postgres real en Docker.

## Git

- **Rama `main` refleja lo que está en producción.**
- **Una rama por tarea:** `tarea/<slug>`. Ejemplo: `tarea/r1-registrar-moto`.
- **Merge por PR** aunque solo lo revise el chat arquitecto. Existe para tener un diff limpio en la revisión.
- **Un commit por lógica atómica**, no un commit por archivo tocado. El diff del PR importa; los commits intermedios se pueden `squash` si hicieron falta muchos.
- **Convención de mensaje:** `tipo(alcance): mensaje`, ejemplos:
  - `feat(ordenes): permitir crear con lavador diferido`
  - `fix(reportes): corregir suma cuando hay órdenes anuladas`
  - `refactor(repositorio): extraer filtro comun a base`
  - `chore(deps): actualizar prisma a 5.20`

## Formato

- **Prettier + ESLint** configurados en la raíz del monorepo.
- **`pnpm lint` corre en CI** y no se puede mergear con errores.
- **`pnpm typecheck` corre en CI** y no se puede mergear con errores de tipo.
- **`pnpm test` corre en CI** y no se puede mergear con pruebas rotas.
- **Line width: 100 columnas.** Ni 80 (obliga a partir muy seguido en español), ni 120 (dificulta leer en pantalla partida).

## Mocks (durante Fase 1)

Los mocks son código de producción, no scratch. Van a existir durante 6 semanas y toman decisiones que las vistas heredan. Reglas:

- Viven en `apps/web/src/mocks/`, un archivo por dominio (`ordenes.ts`, `catalogo.ts`, `trabajadores.ts`, `sesion.ts`, `reportes.ts`, `cierre-caja.ts`).
- **Cada mock exporta las mismas funciones que expondrá el cliente HTTP real en F2.** Misma firma, mismo tipo de retorno, mismos esquemas Zod validando la respuesta. Esa es la clave para reemplazar la capa sin tocar vistas.
- **Los mocks respetan las seis reglas no negociables** (ver `CLAUDE.md`):
  - Todos los montos en centavos enteros. Un servicio de $30.000 se guarda como `3000000`, nunca `30000` ni `"30.000"`.
  - Órdenes copian precios y porcentajes al crearse (congelamiento). El mock lo simula: cuando cambiás el precio de un servicio, las órdenes ya "creadas" mantienen su precio.
  - Nada se borra, se marca inactivo. Los mocks no eliminan del array; ponen `activo: false`.
  - El día operativo se calcula con la función de `packages/shared`, no "a mano" en el mock.
- **Estado en memoria del navegador**, no en `localStorage` (así refrescar la página vuelve al seed limpio; hace las pruebas E2E de F1 deterministas).
- **Latencia simulada:** cada función mock espera 100-300ms antes de responder. Esto obliga a las vistas a manejar estados de carga desde F1.
- **Errores simulados:** un porcentaje configurable de llamadas devuelve error (`sin-respuesta`, `servidor`) para que las vistas ejerzan sus paths de error. Se controla con una variable de entorno (`VITE_MOCK_ERROR_RATE=0.05`).
- **Semilla determinista:** cada `apps/web/src/mocks/seed.ts` produce el mismo estado inicial en cada arranque. Que las pruebas dependan de datos aleatorios es prohibido.
- **Los mocks no simulan reglas de negocio "opinadas".** Si en las 7 preguntas abiertas de `pendientes.md` una decisión no está tomada, el mock adopta una opción explícita, la registra en un comentario `// P-X: se asume X hasta que se decida`, y esa asunción se revalida al final de F1.

## Animaciones

Nivel de pulido C (ver D-28). Reglas:

- **Duración base:** 150ms para micro-interacciones (hover, click), 250ms para transiciones de página o modal, 400ms para entradas/salidas de listas.
- **Curva base:** `ease-out` para entradas, `ease-in` para salidas, `ease-in-out` para movimientos continuos.
- **Sin animaciones que retrasen la interacción.** El feedback de un botón es inmediato; la animación es acompañamiento, no puerta.
- **Prefers-reduced-motion:** todo componente respeta `@media (prefers-reduced-motion: reduce)` y desactiva animaciones para usuarios que lo pidieron. **Regla dura.**
- Usar `<Transition>` y `<TransitionGroup>` de Vue para animar entradas/salidas.
- Para animaciones más complejas (drag & drop, spring), evaluar `@vueuse/motion` cuando aparezca el caso. No agregar librería sin caso concreto.

## Responsive

Tres anchuras objetivo, todas verificables en cada rebanada de F1:

- **Móvil:** 375px de ancho (referencia: iPhone SE). Es el peor caso.
- **Tablet:** 768px (referencia: iPad vertical).
- **Desktop:** 1280px+ (mayoría de PCs).

Reglas:

- **Mobile-first en Tailwind:** las clases sin prefijo son móvil; `md:` para tablet y arriba, `lg:` para desktop.
- **Sin scroll horizontal en móvil.** Nunca. Si algo no cabe, se colapsa a lista scrolleable vertical, se reordena, o se abre en un modal de pantalla completa.
- **Tap targets mínimos 44×44px en móvil.** Botones, links, checkbox, todo.
- **Textos responsive:** clases `text-sm md:text-base lg:text-lg` para textos que crecen en pantallas grandes.
- **Tablas complejas se transforman en cards apilados en móvil.** No hay tabla que sobreviva a 375px de ancho legible.
- **El sidebar es colapsable siempre y drawer en móvil.**
- **Verificación:** al cerrar una vista, probarla en las tres anchuras con las devtools del navegador antes de considerarla hecha.

## Accesibilidad

Nivel objetivo: WCAG 2.1 nivel AA en las partes críticas. Reglas concretas:

- **Foco visible siempre.** El `outline` por defecto se puede reemplazar pero no eliminar. Tailwind: `focus-visible:ring-2 focus-visible:ring-primary`.
- **Navegación completa por teclado.** Toda acción disponible con clic también lo está con teclado. Tab moviendo el foco, Enter/Espacio activando, Escape cerrando modales.
- **Roles ARIA correctos:** `role="dialog"` en modales, `aria-label` en botones sin texto (íconos), `aria-live` en toasts y feedback dinámico, `aria-invalid` en inputs con error.
- **Etiquetas asociadas a inputs:** todo `<input>` tiene un `<label>` con `for` que apunta a su `id`. Nunca solo un placeholder.
- **Contraste de color:** mínimo 4.5:1 para texto normal, 3:1 para texto grande. Verificable con el inspector de Chrome DevTools.
- **Imágenes con `alt`.** Si es decorativa, `alt=""` explícito, no ausente.
- **Formularios con mensajes de error asociados al input** vía `aria-describedby`. Errores anunciados con `aria-live="polite"`.

## Tests de componentes

Vitest + `@vue/test-utils` + `@testing-library/vue`.

- **Un archivo de test por componente reutilizable.** `BotonPrincipal.vue` → `BotonPrincipal.test.ts` en la misma carpeta.
- **Cubrir estados y variantes:** default, hover, disabled, loading, con y sin ícono.
- **Cubrir accesibilidad:** el test verifica presencia de `role`, `aria-label`, foco visible.
- **Cubrir eventos:** `emit` disparados con los payloads correctos.
- **Preferir `@testing-library/vue`** sobre `wrapper.find('.clase-css')` — busca por rol y por texto visible, como lo haría un usuario real. Los tests que buscan por selectores CSS rompen al primer cambio de diseño; los que buscan por accesibilidad rompen solo cuando la accesibilidad se rompe.
- **Snapshots prohibidos.** Ya en las reglas generales, se repite acá porque en componentes es tentador.
- **Tests de vista** (no de componente reutilizable) se mockean el cliente HTTP y validan que la vista pide las cosas correctas y renderiza según respuesta. No mockean componentes internos.
