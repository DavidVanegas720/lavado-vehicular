# Plan de rebanadas

Este documento es el orden en que se construye el sistema. Está organizado en dos fases explícitas, según la decisión D-28 de `decisiones.md`.

- **Fase 1 (F1)** — Frontend completo con calidad de producción y capa de mocks. Sin backend, sin base, sin despliegue. Todo local. ~6 semanas.
- **Fase 2 (F2)** — Backend por rebanadas verticales. Cada rebanada toma una vista de F1 y le conecta backend + base + auth reales.

## Antes de F1: preparación mínima

Cosas de una sola vez antes de la primera rebanada de F1.

### FP-0: Bootstrap del monorepo (solo frontend por ahora)

- Estructura de carpetas: `apps/web`, `packages/shared` (con los esquemas Zod ya escritos; `apps/api` se agrega en FP-F2).
- Vue 3 + Vite + Pinia + Tailwind + PrimeVue + TypeScript strict.
- ESLint + Prettier + `pnpm typecheck` + `pnpm test` en CI.
- Vitest + Vue Test Utils configurado.
- Playwright configurado (aunque las E2E de F1 corren contra los mocks).
- Sentry configurado en modo consola.
- Repositorio en GitHub, Dependabot activado, `gitleaks` pre-commit.

**No incluye:** `apps/api`, Prisma, Docker Compose, Neon, Render, Cloudflare Pages. Todo eso llega en FP-F2 (preparación de Fase 2).

---

## Fase 1 — Frontend con mocks

Cinco rebanadas de frontend. Cada una entrega vistas navegables, con animaciones, responsive (móvil / tablet / desktop), accesibilidad (foco visible, roles ARIA, navegación por teclado), y tests de componentes.

**Redefinición de "rebanada vertical" durante F1:** una rebanada de F1 entrega N vistas relacionadas + los componentes reutilizables que necesitan + su capa de mocks + tests + verificación en navegador en las tres anchuras de pantalla. La integración con backend NO es parte de F1.

**Regla que sigue vigente:** los mocks respetan estrictamente el modelo de datos y las seis reglas no negociables. Ver `convenciones-codigo.md` sección "Mocks". Nada de datos con dinero en formato peso (siempre centavos enteros). Nada de precios que "cambian" en órdenes viejas (los mocks mantienen los precios congelados por orden).

### F1-1: Fundación y componentes base

**Objetivo:** el frontend arranca, se ve, tiene navegación, tema, y un conjunto de componentes reutilizables cerrados.

**Entrega:**
- Layout principal con sidebar colapsable + topbar.
- Ruteo con Vue Router.
- Tema (colores, tipografía, espaciados) usando Tailwind + tokens propios.
- Modo claro + modo oscuro (con toggle y persistencia en localStorage).
- Capa de mocks (`apps/web/src/mocks/`) con datos seed para un negocio, dueño, operador, dos trabajadores, tres servicios, tres rangos, matriz de precios, 20 órdenes de ejemplo distribuidas en el día operativo actual.
- Cliente HTTP (`apps/web/src/api/cliente.ts`) con dos modos: `mock` (default en F1) y `http` (llega en F2). Las vistas consumen el cliente, no los mocks directos.
- Componentes reutilizables:
  - `BotonPrincipal`, `BotonSecundario`, `BotonPeligro`
  - `TarjetaBase`
  - `TablaBase` (con paginación, orden, filtro básico, estados de carga / vacío / error)
  - `FormularioBase` (con validación Zod)
  - `EntradaTexto`, `EntradaNumero`, `EntradaCorreo`, `EntradaContrasena`
  - `EntradaDinero` (formato COP en vivo, guarda centavos internamente)
  - `SelectorBase` con variantes de servicio, rango, trabajador, método de pago
  - `TarjetaOrden` (usada en el tablero)
  - `BadgeEstado` (uno por cada `EstadoOrden`)
  - `DialogoModal`, `DialogoConfirmacion` (para acciones peligrosas)
  - `Toast` / `Notificacion` (composable + componente)
  - `SkeletonCargando`
  - `EstadoVacio`
  - `EncabezadoPagina`
  - `SelectorRangoFechas`
- Composable de formato de moneda (`useFormatoMoneda`).
- Composable de día operativo (idéntica al que estará en `packages/shared` — vive ahí desde F1).
- Animaciones base: transiciones de página, entrada/salida de modales, feedback de botones, aparición de toasts.
- Tests de componentes: uno por cada componente reutilizable, cubriendo estados y variantes.
- Prueba E2E con Playwright: navegar entre 3 páginas placeholder, cambiar tema, ver que los componentes renderizan.

**Verificación en navegador:** móvil (375px), tablet (768px), desktop (1280px+). Todos los componentes se ven bien en las tres.

### F1-2: Autenticación mockeada

**Objetivo:** el flujo de sesión funciona de punta a punta contra los mocks.

**Entrega:**
- Vista de login (usuario + contraseña + validación en vivo con Zod + mensajes de error específicos + tecla enter envía + botón muestra spinner).
- Sesión falsa persistida en `sessionStorage` (para F1; en F2 se reemplaza por cookie httpOnly del backend real).
- Guard de rutas: rutas protegidas redirigen a login si no hay sesión.
- Store de Pinia `useSesion` con `usuarioActual`, `iniciarSesion`, `cerrarSesion`.
- Vista de perfil (ver datos, editar nombre).
- Vista de cambio de contraseña (contraseña actual + nueva + confirmación + validación).
- Vista de "sesión expirada" (aparece si el mock devuelve `no-autenticado`).
- Animaciones de transición entre login y app.
- Tres cuentas mockeadas para probar: un superadmin, un dueño, un operador.
- Tests de componentes para las cuatro vistas.
- Prueba E2E: iniciar sesión con las tres cuentas, ver que cada una llega a su vista inicial, cerrar sesión.

**Verificación en navegador:** las tres anchuras. Login funciona con teclado sin tocar el mouse.

### F1-3: Operación diaria

**Objetivo:** todo lo que hace un OPERADOR en el día.

**Entrega:**
- **Tablero del día:** grilla de tarjetas de orden, agrupadas por estado (`CREADA`, `LAVANDO`, `LISTA`, `COBRADA`), con contador por columna, filtro por trabajador, refresh a mano. Auto-refresh cada 30s (contra el mock).
- **Crear orden:** modal con formulario multi-paso: placa (con validación colombiana), cilindraje, rango (autoseleccionado), paquete, adicionales opcionales, trabajador asignado. Muestra el total calculado. Al enviar, la orden aparece en el tablero con animación.
- **Detalle de orden:** modal o vista dedicada. Muestra todo: ítems con precio congelado, trabajador, estado, historial de eventos, comisión estimada. Los botones de acción cambian según estado y rol.
- **Cobrar orden:** modal con método (efectivo/QR/otro), monto (`EntradaDinero`), campo `concepto` que aparece automáticamente si el monto supera el total de ítems.
- **Aplicar cortesía:** solo visible para DUENO al crear/editar orden. Toggle + motivo obligatorio.
- **Aplicar descuento:** solo visible para DUENO al cobrar. Campo con concepto obligatorio.
- **Anular orden:** solo visible para DUENO. Diálogo de confirmación con motivo obligatorio.
- **Anular y re-crear:** flujo especial cuando el motivo de anulación es "servicio incorrecto". Copia placa y trabajador a una nueva orden.
- **Entregar:** botón en órdenes COBRADAS.
- Animaciones: entrada/salida de tarjetas del tablero, cambio de columna al cambiar estado, feedback de cobro exitoso.
- Los mocks respetan los estados y las reglas: no se puede cobrar una orden `CREADA` sin pasar por `LISTA`, el excedente exige concepto, la cortesía no genera pago pero sí comisión.
- Tests de componentes de cada vista.
- Prueba E2E: crear orden, moverla por los estados, cobrarla, entregarla. Otra prueba: cortesía. Otra: anular y re-crear.

**Verificación en navegador:** las tres anchuras. En móvil, el tablero se colapsa a lista scrolleable con filtro de estado. En desktop es grilla.

### F1-4: Catálogo y gestión

**Objetivo:** todo lo que configura el DUENO.

**Entrega:**
- **Servicios:** lista + CRUD de paquetes y adicionales. Marca inactivo (no borra).
- **Rangos de cilindraje:** lista + CRUD. Validación de no solapamiento entre rangos.
- **Matriz de precios:** tabla editable servicio × rango. Cambios se guardan por celda con confirmación visual.
- **Trabajadores:** lista + CRUD. Marca inactivo (no borra).
- **Acuerdos de comisión:** por trabajador, ver historial de %, crear uno nuevo cierra el vigente.
- **Operadores del negocio:** solo DUENO. Lista + CRUD.
- **Configuración del negocio:** nombre, horario (apertura/cierre), zona horaria. Solo DUENO.
- Los cambios en catálogo no afectan mocks de órdenes ya creadas (el mock respeta el congelamiento).
- Animaciones de entrada de filas en tablas, feedback de edición inline.
- Tests de componentes.
- Prueba E2E: crear un servicio, ponerle precio en la matriz, crear una orden con ese servicio, editar el servicio, ver que la orden vieja mantiene el nombre y precio congelados.

**Verificación en navegador:** las tres anchuras. En móvil, la matriz de precios se convierte en una lista de "por servicio, precios por rango".

### F1-5: Reportes y cierre

**Objetivo:** todo lo que ve el DUENO al final del día / semana / mes.

**Entrega:**
- **Reportes** con pestañas Diario / Semanal / Mensual y selector de rango de fechas custom.
  - Motos lavadas.
  - Ingresos totales, desglosados por método de pago.
  - Comisiones a pagar, desglosadas por trabajador (con el % congelado de cada orden).
  - Ganancia bruta del negocio.
  - Exportable a CSV.
  - Solo DUENO.
- **Comisiones por lavador:** vista específica que muestra por trabajador: motos lavadas, precio de lista total, % aplicado (con nota si varió en el período), comisión total. Los mocks tienen dos trabajadores, uno con historial de dos acuerdos, para que se vea el caso.
- **Cierre de caja del día:** total esperado (calculado desde los mocks del día operativo), campo para total reportado, diferencia calculada al escribir, botón "Cerrar". Los mocks impiden dos cierres del mismo día.
- **Gráficas:** líneas de ingresos por día en el mes (recharts o chart.js integrado a Vue).
- Animaciones: transición entre pestañas, aparición progresiva de los números al cargar.
- Tests de componentes.
- Prueba E2E: navegar los tres reportes, exportar CSV (validar que se descarga), cerrar caja, intentar cerrar de nuevo, ver que falla.

**Verificación en navegador:** las tres anchuras. En móvil, las tablas se convierten en cards apilados. Las gráficas mantienen legibilidad.

---

## Cierre de Fase 1

Antes de arrancar F2, Carlos debería poder ejecutar el frontend en tu computador y navegar las 16 vistas como si el sistema estuviera vivo. Esta es la oportunidad para pedirle feedback antes de comprometerse con el backend.

**Cosas a validar con Carlos en este momento:**
- Los flujos de operación reflejan cómo funciona el lavadero.
- Los reportes muestran lo que él necesita ver.
- Los términos y nombres coinciden con los que él usa.
- Ninguna vista lo obliga a hacer algo que no haría normalmente.

Cualquier ajuste que salga de esta validación se hace en frontend antes de arrancar F2. Es mucho más barato acá que después.

**Las 7 preguntas abiertas P-A a P-G se reevalúan en este momento.** Los mocks asumieron respuestas razonables; si Carlos confirma otras, se ajustan los mocks (rápido) antes de codificar el backend (caro de cambiar).

---

## Antes de F2: preparación de backend

### FP-F2-1: Bootstrap del backend

- `apps/api` con Fastify + Prisma + Zod.
- Los esquemas Zod que ya viven en `packages/shared` (fueron la base del cliente HTTP durante F1) ahora también los consume el backend.
- `docker-compose.yml` con Postgres para desarrollo local.
- Estructura de módulos ya definida en `arquitectura.md`.
- Middleware de auth global con opt-out explícito.
- `@fastify/helmet`, `@fastify/cookie`, `@fastify/rate-limit`, `argon2` instalados.
- Sentry en el backend.
- Comando `pnpm db:migrar-prod` con `confirmarDestino()`.

### FP-F2-2: Schema Prisma + scripts de superadmin

- Schema de `modelo-datos.md` migrado.
- Script `pnpm crear-superadmin` para crear la cuenta de David.
- Script `pnpm crear-negocio` para crear Medallo Bikes + cuenta de dueño de Carlos.
- Script `pnpm seed:medallo-bikes` con rangos, servicios, precios, y un trabajador inicial.

### FP-F2-3: Hosting y despliegue

- Backend desplegado en Render (responde 200 en `/api/salud` sin tocar la base).
- Neon Postgres creado y con la primera migración corrida.
- Frontend desplegado en Cloudflare Pages con Pages Function que reenvía `/api/*` a Render.
- Cron-job.org pingando `/api/salud` cada 10 min.
- GitHub Action de respaldo diario configurada y **probada al menos una vez** (dump generado + restaurado en un entorno de prueba).

**FP-F2-3 es obligatorio antes de la primera rebanada de F2 que toque dinero (F2-2 en adelante).**

---

## Fase 2 — Backend por rebanadas verticales

Siete rebanadas. Cada una toma una vista o grupo de vistas ya construidas en F1 y le conecta backend real + base + auth. La capa de mocks se reemplaza módulo por módulo.

**Regla:** una vez que un módulo pasa a HTTP real, no vuelve a mock. Si un cambio del backend obliga a modificar la vista, el mock se actualiza también (para consistencia) pero el flag del cliente HTTP para ese módulo queda en `http` permanentemente.

### F2-1: Autenticación real

**Reemplaza:** los mocks de sesión de F1-2.
**Entrega:**
- Módulos `auth` y `usuarios` en el backend.
- Login real con hash argon2id, cookie httpOnly, sesión en tabla.
- Rate limit en el login (regla 11 de `seguridad.md`).
- El frontend reemplaza `sessionStorage` por la cookie del backend. Las vistas de F1-2 no cambian en su forma, solo la fuente de datos.
- Prueba E2E: iniciar sesión con las tres cuentas creadas por script, cerrar sesión, intentar acceder a una ruta protegida sin sesión.

### F2-2: Órdenes: crear y ver

**Reemplaza:** parte de los mocks de F1-3 (tablero + crear orden + detalle).
**Entrega:**
- Módulos `catalogo` (solo lectura por ahora), `trabajadores` (solo lectura), `ordenes`.
- Endpoints para crear orden, listar tablero, ver detalle.
- Congelamiento real: al crear la orden, los cuatro campos se copian del catálogo actual.
- Prueba E2E: crear una orden real, verla en el tablero, verla en detalle.

**Requiere:** FP-F2-3 completo (respaldo probado). Aunque esta rebanada no cobra, empieza a tocar la base con datos que después se van a cobrar.

**Antes de esta rebanada, revisitar P-F y P-G:** órdenes fuera de horario, y asignación diferible del lavador.

### F2-3: Cobrar y entregar

**Reemplaza:** el resto de F1-3 (cobrar, cortesía, entregar).
**Entrega:**
- Endpoints para cobrar, marcar cortesía, entregar.
- Manejo del pago excedente con concepto.
- Cortesía con motivo, sin generar pago, generando comisión.
- Prueba E2E: crear orden, cobrar, entregar. Otra: cortesía. Verificar que la comisión se calcula igual en ambos casos.

**Antes de esta rebanada, revisitar P-A:** concepto libre vs lista predefinida para pago excedente.

### F2-4: Catálogo desde la interfaz

**Reemplaza:** los mocks de F1-4 (excepto trabajadores/acuerdos, que van en F2-5).
**Entrega:**
- Endpoints CRUD para servicios, rangos, precios, operadores del negocio.
- El congelamiento se prueba en producción: cambiar precio de un servicio, ver que las órdenes viejas mantienen el precio congelado.
- Prueba E2E de cada CRUD + verificación de congelamiento.

### F2-5: Trabajadores, comisiones y anulaciones

**Reemplaza:** la parte de trabajadores/acuerdos de F1-4 y los flujos de anulación de F1-3.
**Entrega:**
- Endpoints CRUD para trabajadores y acuerdos.
- Cambio de acuerdo cierra el vigente, crea uno nuevo, respeta el porcentaje congelado en órdenes viejas.
- Endpoint de anulación con motivo obligatorio.
- Flujo "anular y re-crear" con `orden_reemplaza_id`.
- Prueba E2E.

**Antes de esta rebanada, revisitar P-B, P-C, P-D:** manejo del pago en órdenes anuladas, descuento como campo o concepto, adicionales en órdenes ya cobradas.

### F2-6: Cierre de caja

**Reemplaza:** los mocks de cierre de caja de F1-5.
**Entrega:**
- Endpoint del cierre.
- Un cierre por día operativo por negocio (constraint único).
- Cálculo del total esperado desde los pagos reales.
- Prueba E2E: crear órdenes, cobrar, cerrar caja, intentar cerrar de nuevo y ver que falla.

**Antes de esta rebanada, revisitar P-E:** obligatoriedad del cierre.

### F2-7: Reportes

**Reemplaza:** los mocks de reportes de F1-5.
**Entrega:**
- Endpoints de reporte diario, semanal, mensual.
- Cálculo con los porcentajes congelados de cada orden.
- Endpoint de exportación a CSV.
- Prueba E2E.

---

## Regla de pago de deuda

Cada dos rebanadas cerradas (contando F1 y F2 juntas), se agenda una tarea intermedia de "pago de deuda" que revisa `pendientes.md` y resuelve hallazgos.

- Tras F1-2 → deuda A
- Tras F1-4 → deuda B
- Tras F2-1 → deuda C
- Tras F2-3 → deuda D
- Tras F2-5 → deuda E
- Tras F2-7 → deuda F (cierre general del proyecto)

## Después de F2

Con las 12 rebanadas cerradas (5 de F1 + 7 de F2), el sistema es operativamente completo. Recién ahí se piensa en panel de superadmin, auto-onboarding, habilitación de carros u optimizaciones de arranque en frío. Ninguna de estas cosas se anticipa.
