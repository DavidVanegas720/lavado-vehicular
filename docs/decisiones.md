# Decisiones tomadas

Este documento reúne todas las decisiones importantes ya aprobadas por David. Cada una tiene su razón. Antes de proponer cambiar cualquiera de estas, hay que releer el porqué original y consultar a David.

**Formato:** cada decisión numerada, breve, con "qué se decidió", "por qué", y "alternativas descartadas" cuando aplica.

---

## Stack técnico

### D-01: Node.js + TypeScript en backend, no Python

**Decidido:** el backend es Node.js 20 + TypeScript.

**Por qué:** David ya sabe TypeScript (proyecto XeroxUI). No hay carga de trabajo (ML, cálculo numérico, scraping intensivo) que empuje a Python. Mantener un solo lenguaje entre backend y frontend permite compartir esquemas Zod. Cambiar a Python significaría aprender FastAPI + Pydantic + SQLAlchemy mientras se reescribe todo, sin beneficio proporcional.

**Alternativas descartadas:** Python (sin razón de dominio), Go (curva más empinada, menos ganancia).

---

### D-02: Fastify, no Nest, no Express, no Nuxt

**Decidido:** framework de backend es Fastify.

**Por qué:** el proyecto anterior tuvo problemas documentados con NestJS (`Scope.REQUEST` contagioso, orden frágil de interceptores → H-50). Fastify es minimalista, rápido, con plugins componibles en vez de DI mágica. Para un monolito de este tamaño (9 módulos), es la relación complejidad/beneficio correcta.

**Alternativas descartadas:** 
- NestJS: fricción estructural documentada en el proyecto anterior.
- Express: más viejo, tipado más pobre, sin razones para preferirlo hoy.
- Nuxt (server routes): David lo descartó explícitamente.
- Hono: ecosistema Node menos maduro para lo que necesitamos.

---

### D-03: Prisma como ORM, no Drizzle

**Decidido:** el ORM es Prisma.

**Por qué:** David descartó Drizzle explícitamente. Prisma es más maduro para PostgreSQL, tiene generador de tipos sólido, y el flujo de migraciones es predecible. La única cosa que hay que envolver es el comando de deploy con `confirmarDestino()`, para evitar el incidente H-56 del proyecto anterior.

---

### D-04: Vue 3 + Pinia + PrimeVue + Tailwind en frontend

**Decidido:** el frontend es Vue 3 (Composition API) con Vite, Pinia para estado, PrimeVue para componentes, Tailwind para layout.

**Por qué:** David ya lo conoce (XeroxUI, sistema anterior). El proyecto anterior lo usó sin problemas serios. No hay razón para cambiar el stack del frontend en el reinicio — el problema estaba en el alcance, no en la forma.

---

### D-05: Monorepo con pnpm workspaces, tres paquetes

**Decidido:** `apps/api`, `apps/web`, `packages/shared`. Sin Turborepo, sin Nx.

**Por qué:** `packages/shared` es donde viven los esquemas Zod que definen los contratos HTTP. El frontend importa los tipos sin duplicar nada a mano. pnpm sin orquestador extra alcanza para tres paquetes.

**Sin doble build CJS+ESM.** Con Vitest en los dos lados, el paquete compartido se compila una sola vez a ESM y ambos lados lo consumen. Elimina la fricción de T-007 del proyecto anterior.

---

### D-06: Vitest + Playwright, no Jest

**Decidido:** Vitest para pruebas unitarias e integración en backend y frontend. Playwright para E2E.

**Por qué:** Vitest tiene mejor performance, mejor DX, y elimina la fricción de Jest + Vitest coexistiendo en el proyecto anterior. Es del mismo equipo que Vite, muy intencional con la compatibilidad Node. Playwright es el estándar de facto para E2E en 2026 y su detección de errores es superior a Cypress.

---

## Base de datos y modelo

### D-07: Sin RLS, sin roles múltiples de PostgreSQL

**Decidido:** un solo rol de aplicación de PostgreSQL. Sin Row-Level Security. El aislamiento por negocio se resuelve con la columna `negocio_id` filtrada exclusivamente en la capa de repositorio.

**Por qué:** el análisis del proyecto anterior (sección 2 de la retrospectiva) mostró que la "mitad cara" del aislamiento (RLS + cuatro roles) generó el mayor foco de fricción documentado, mientras que la "mitad barata" (columna + filtro en repositorio) previene el mismo riesgo con costo trivial. RLS es aditivo: se puede agregar en una migración el día que aparezca un segundo negocio, sin tocar código de aplicación.

**Con un solo negocio, RLS protege de un riesgo cuya consecuencia es exactamente cero.**

---

### D-08: Congelamiento por copia, no por referencia versionada

**Decidido:** los cuatro campos congelados de la orden (% comisión, rango, trabajador, ítem con nombre + precio) se copian al momento de crear la orden. No hay tabla de "versiones de precio" ni referencia a un `precio_id` versionado.

**Por qué:** copiar el valor es simple, resistente a cambios futuros, y hace las órdenes viejas legibles aún cuando el catálogo se transforme. El proyecto anterior aplicó esta regla (decisiones 22-27 de esa especificación) y fue de sus mejores decisiones — no se rompió ninguna vez.

---

### D-09: Dinero en enteros, en centavos

**Decidido:** todos los montos son `Int` en Prisma, expresados en centavos.

**Por qué:** evita toda clase de bug de redondeo de `Float`. El nombre del campo lleva sufijo `_centavos` para que sea imposible confundirse con "un peso o cien pesos".

---

### D-10: Pagos N:1 con orden, "pagada" derivado

**Decidido:** una orden tiene N pagos. El estado "cobrada" es derivado: `sum(pagos.monto) >= sum(items.precio) + ajustes`.

**Por qué:** permite cobros parciales, cobros con múltiples métodos (parte efectivo + parte QR), y cobros excedentes con concepto. Los pagos son inmutables, así que la suma siempre cuadra. Es la decisión 24 del proyecto anterior.

---

### D-11: Vehículo con `tipo` (moto/carro), preparado sin construir

**Decidido:** la tabla `Vehiculo` tiene una columna `tipo` con valor por defecto `MOTO`. La columna existe hoy; el flujo de carros no se construye hasta que un negocio lo pida.

**Por qué:** aplica el principio "que la estructura no lo impida es distinto de implementarlo" (decisión 38 del proyecto anterior). El modelo se preparó bien; la interfaz no se anticipa.

---

### D-12: Una sola función de "día operativo"

**Decidido:** el cálculo del día operativo vive en `packages/shared/src/dominio/dia-operativo.ts` y todas las consultas, reportes y cierres pasan por ahí. Nunca se calcula "a mano" en otro lado.

**Por qué:** el proyecto anterior lo tuvo como regla (regla 5 de sus no negociables) y no se rompió. Centralizar cálculos que atraviesan todo el sistema es lo que hace posible cambiarlos después.

---

## Autenticación y sesión

### D-13: Cookie httpOnly, no JWT

**Decidido:** sesión vía cookie `httpOnly`, `Secure`, `SameSite=Lax`, con un token opaco. Nada en `localStorage`.

**Por qué:** JWT no se puede revocar; cerrar el acceso a alguien tiene que ser borrar una fila, no esperar a que expire. Cookie `httpOnly` no es accesible desde JavaScript, así que XSS no puede robarla. `SameSite=Lax` protege contra CSRF sin necesidad de tokens CSRF adicionales.

---

### D-14: Mismo origen vía Cloudflare Pages Function

**Decidido:** en producción, frontend y backend son el mismo origen desde el punto de vista del navegador. Se logra con una Pages Function que reenvía `/api/*` a Render sin reescribir.

**Por qué:** evita `SameSite=None` y toda la superficie de ataque de cookies de terceros. Es exactamente la solución del proyecto anterior, sección 6 de la retrospectiva.

---

### D-15: Tres roles fijos codificados como enum

**Decidido:** los roles son `SUPERADMIN`, `DUENO`, `OPERADOR`, definidos como `enum Rol` en Prisma. Los permisos por rol están codificados en el backend.

**Por qué:** una matriz configurable de permisos es un mes de trabajo para resolver un problema que Medallo Bikes no tiene. El proyecto anterior murió por decisiones de esta forma tomadas hacia el lado ambicioso. Si algún día un negocio necesita un cuarto rol, se agrega un valor al enum en un día.

---

## Producto y alcance

### D-16: Sin panel de superadmin en el reinicio

**Decidido:** las operaciones de superadmin (crear negocio, suspender, cambiar plan, habilitar carros) se hacen con scripts (`pnpm crear-negocio`, `pnpm suspender-negocio`, etc.), no con panel web. El panel se construye cuando exista un segundo negocio que pague.

**Por qué:** con un cliente, un panel de superadmin es una pantalla que solo David usa una vez para crear ese cliente. Un script hace lo mismo en 30 segundos y no requiere construir autenticación de plataforma paralela.

Esto es directamente el error que la sección 2 de la retrospectiva del proyecto anterior identificó como el 71% de la deuda. No se repite.

---

### D-17: Sin devoluciones de dinero, jamás

**Decidido:** el sistema no permite generar reembolsos, en ningún flujo, bajo ningún rol. Anular una orden cobrada deja el pago registrado; la compensación es externa.

**Por qué:** regla explícita del negocio para prevenir fraude interno. Es también la conclusión de la decisión 52 del proyecto anterior (que anduvo casi dos semanas construyendo devoluciones antes de descubrir que el dueño no las quería).

---

### D-18: Comisión sobre precio de lista, no sobre cobrado

**Decidido:** la comisión al lavador se calcula sobre el precio congelado del ítem, no sobre lo cobrado. Descuentos y cortesías los absorbe el negocio.

**Por qué:** protege al trabajador de las negociaciones que hace el dueño. Es una decisión del propio David; también fue regla 2 del proyecto anterior.

---

### D-19: Un lavador por orden

**Decidido:** cada orden tiene un solo `trabajador_id`. Si otro lavador ayuda, no le corresponde comisión.

**Por qué:** David lo decidió explícitamente. Simplifica el modelo y el cálculo de comisiones.

---

### D-20: Congelamiento del % al crear la orden, no al cobrar

**Decidido:** el porcentaje de comisión del lavador se congela en `Orden.porcentaje_comision_congelado` al momento de **crear** la orden. Si el acuerdo cambia entre creación y cobro, la orden mantiene el % del momento de creación.

**Por qué:** David lo decidió explícitamente. Alternativa (congelar al cobrar) se descartó porque la orden puede vivir horas o días entre creación y cobro, y el trabajador tiene que saber desde el principio cuánto le va a corresponder.

---

## Infraestructura

### D-21: Capa gratuita, con keep-alive obligatorio desde el día uno

**Decidido:** el sistema corre en capa gratuita (Render + Neon + Cloudflare Pages + R2 + Sentry). El keep-alive vía cron-job.org pingando `/api/salud` cada 10 minutos **es parte del bootstrap (P-3), no de un paso posterior**.

**Por qué:** Medallo Bikes no paga por el sistema todavía. Gastar plata que no está entrando no tiene sentido. **Pero** la sección 3 de la retrospectiva del proyecto anterior mostró que operar en capa gratuita sin la mitigación del arranque en frío no funciona — la mitigación tiene que existir desde el principio.

El día que alguien pague por el sistema, se pasa a plan pago y se pueden quitar varias capas de mitigación.

---

### D-22: Respaldo diario por GitHub Action, no por proceso interno

**Decidido:** el respaldo lo dispara una GitHub Action programada diariamente, contra un endpoint autenticado por secreto compartido. **No hay `setInterval` interno para respaldos.**

**Por qué:** el proyecto anterior tuvo respaldos internos vía `setInterval` que nunca corrieron porque el proceso muere con inactividad en la capa gratuita. Separar la agenda externamente lo vuelve independiente del ciclo de vida del proceso de la API.

---

### D-23: Migración con confirmación de destino

**Decidido:** `pnpm db:migrar-prod` envuelve `prisma migrate deploy` con dos pasos: imprime el host y exige teclearlo para confirmar. La aplicación también verifica al arrancar que la migración esperada está aplicada y falla ruidosamente si no.

**Por qué:** el proyecto anterior tuvo H-56 (migración 0007 "dada por aplicada" sin estarlo, un día sin poder registrar pagos). Este es el mecanismo que hace imposible ese error.

---

### D-24: Sentry desde el día uno

**Decidido:** Sentry configurado en frontend y backend desde el bootstrap (P-1). Free tier alcanza (5k eventos/mes).

**Por qué:** para un sistema que va a tocar dinero real desde la rebanada 2, tener un lugar donde ver errores de producción antes de que Carlos llame es más importante que tener una prueba E2E adicional. Es una hora de trabajo y desaparece una clase entera de "algo se rompió y no sabemos qué".

---

## Metodología

### D-25: Rebanadas verticales, no capas horizontales

**Decidido:** cada tarea es una rebanada vertical completa (base → API → pantalla → verificada en navegador). Prohibido "solo el backend, la pantalla después".

**Por qué:** el proyecto anterior partió horizontalmente siete veces y siempre dejó piezas huérfanas. Ver sección 8 de la retrospectiva.

---

### D-26: Revisor lee el diff, no el informe

**Decidido:** cuando el chat de tarea cierra, el chat arquitecto lee `git diff` antes que el informe. El informe queda para el porqué de decisiones no obvias.

**Por qué:** un informe es lo que el implementador cree que hizo. El diff es lo que hizo. Sección 10 de la retrospectiva.

---

### D-27: Informes de máximo 30 líneas, hallazgos de máximo 10

**Decidido:** tope duro. Un informe más largo se corta; un hallazgo más largo se convierte en tarea.

**Por qué:** el proyecto anterior tuvo 12.455 líneas de informes para 39.500 de código. Se volvió un segundo sistema que también se desactualizó. Sección 8 de la retrospectiva.

---

### D-28: Frontend completo antes que backend (opción 2 explícita)

**Decidido:** el proyecto se construye en dos fases explícitas:
- **Fase 1 (F1)** — Todo el frontend con calidad de producción y una capa de mocks: 16 vistas, componentes reutilizables, animaciones, responsive completo, accesibilidad, tests de componentes. Sin backend, sin base, sin despliegue. Todo local. Estimación: 6 semanas.
- **Fase 2 (F2)** — Backend por rebanadas verticales. Cada rebanada toma una vista ya construida y le conecta backend real + base + auth. La capa de mocks se reemplaza por HTTP real un módulo a la vez.

**Por qué:** David reportó estrés y confusión con el backend suficientes como para que fuera una amenaza a la continuidad del proyecto. Bajar ese estrés construyendo primero la parte que sí maneja con confianza es el trade que sostiene el proyecto en el tiempo. La decisión es explícita y consciente.

**Riesgo asumido:** esto contradice estructuralmente la lección de "rebanadas verticales" que documenta la retrospectiva del proyecto anterior (secciones 8 y 10). Los mocks pueden ocultar decisiones de dominio que el backend real obligaría a enfrentar antes; cuando aparezcan en F2, algunas vistas pueden requerir retrabajo. Se acepta el riesgo a cambio de que el proyecto sobreviva.

**Mitigaciones dentro de F1:**
- Los mocks respetan estrictamente el modelo de datos y las seis reglas no negociables. Dinero en centavos enteros aunque sea mock. Precios y comisiones congeladas aunque los datos sean falsos. El frontend se comporta como si el backend real estuviera atrás.
- La capa de mocks (`apps/web/src/mocks/`) es reemplazable: la interfaz que expone al resto del frontend es la misma que expondrá el cliente HTTP real.
- Si a mitad de F1 aparece señal de que se está construyendo sobre un supuesto de dominio no resuelto, se pausa y se consulta a David antes de seguir.

**Nivel de pulido (dentro de opción 2, sub-opción C):** F1 entrega vistas con animaciones, responsive completo para móvil/tablet/desktop, accesibilidad (foco visible, roles ARIA, navegación por teclado), y tests de componentes con Vitest + Vue Test Utils.

**Alternativa descartada explícitamente:** rebanadas verticales estrictas desde el inicio (backend + frontend juntos por feature). Es lo que las lecciones del proyecto anterior recomiendan; se descarta por razón de bienestar del desarrollador. La razón queda registrada acá para que en retrospectivas futuras se pueda evaluar si valió la pena.

---

## Decisiones pendientes

Las siguientes decisiones NO están tomadas y bloquean rebanadas específicas. Ver `pendientes.md` para el detalle:

- **P-A** (bloquea R2): Cómo distinguir el pago excedente entre "propina" y "sin cambio" (lista predefinida vs texto libre).
- **P-B** (bloquea R4): Comportamiento del pago de la orden anulada cuando se re-crea (marcado "por acreditar" vs "efectivo ya recibido").
- **P-C** (bloquea R4): Descuento — campo separado o dentro del concepto del pago.
- **P-D** (bloquea R4): Se pueden agregar adicionales a una orden ya cobrada o no.
- **P-E** (bloquea R6): Obligatoriedad del cierre de caja — bloquea día siguiente o es flexible.
- **P-F** (bloquea creación de órdenes): Órdenes creadas fuera del horario 8am-5pm — se aceptan al día de hoy, se rechazan, o se cuentan al día siguiente.
- **P-G** (bloquea R1): Asignación del lavador — obligatoria al crear la orden o puede quedar sin asignar hasta después.
