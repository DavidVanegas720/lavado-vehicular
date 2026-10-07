# Lecciones del proyecto anterior

Este documento condensa la retrospectiva de la primera versión del sistema (proyecto "spa-motos", 21 días, 154 commits, 39.500 líneas, cero órdenes reales creadas). No es historia — es la fuente de las prohibiciones de `CLAUDE.md`.

Leer al empezar cada rebanada, antes de proponer algo grande.

## El error de fondo

**Se construyó un SaaS multi-tenant para un solo cliente.** El 71% de la deuda documentada tenía como raíz decisiones tomadas hacia "cuando lleguen más negocios" en lugar de "para el negocio que hay". Ejemplos:

- Aislamiento por RLS + cuatro roles de PostgreSQL → habría bastado con una columna `negocio_id` filtrada en repositorio.
- Autenticación dual (plataforma + negocio) → habría bastado con un solo dominio de sesión con un rol `SUPERADMIN`.
- Panel de superadmin web con métricas, gráficas, gestión de suscripciones → habrían bastado scripts CLI.
- Sistema de planes y facturación → no existía nadie a quien facturar; se construyó igual.

**Regla:** todo lo anticipado para clientes que no existen es deuda garantizada. Si Medallo Bikes es el único negocio, se construye para Medallo Bikes. La estructura se prepara donde el costo es trivial (columna `negocio_id`, campo `tipo` en vehículo, campo `plan` en negocio); el resto se agrega el día que un problema real lo pida.

## "Hecha" no es "commiteada"

**Tareas que se marcaron como hechas y no funcionaban:**
- Respaldo con código escrito, bucket nunca configurado, cero respaldos generados en tres semanas. Marcada hecha.
- Keep-alive nunca construido, aunque estaba en el checklist. Marcado hecho como parte de otra tarea.
- Feature flags con código que decía "flag activada" y consulta a base decía "flag inactiva". Marcada hecha.

**Regla:** una tarea no está hecha si la funcionalidad no está funcionando en el sistema desplegado, verificable desde afuera. Escribir código no es hacer. Correr una suite verde no es verificar. Un E2E con Playwright que ejerce el flujo real es lo que convierte "verde" en "funciona".

## Partir horizontalmente mata el proyecto

**Siete tareas partidas horizontalmente:**
- Backend de una feature en una tarea, frontend en otra, integración "para después".

**Consecuencia:** para el commit 154 había cinco endpoints funcionales sin pantalla, tres pantallas mostrando datos falsos, y ninguna feature completa que un usuario pudiera usar.

**Regla:** cada tarea entrega una rebanada vertical completa. Base → API → pantalla → verificada en navegador. Si una tarea no puede ser usada por un usuario real al terminar, se replantea antes de empezar.

## Preguntarle al dueño antes de asumir

**El caso T-018:** se asumió que el sistema tenía política de "devoluciones a 30 días". Se construyó (endpoints, pantallas, cálculos, reportes ajustados, casi dos semanas de trabajo). Nueve días después, en la reunión de checkpoint con Carlos, salió que **el negocio no hace devoluciones jamás**. Toda la funcionalidad tuvo que anularse.

**Regla:** antes de escribir una regla de negocio en código, preguntarle a David (que consulta al dueño si hace falta). El chat de tarea no puede inventar reglas. Si en `reglas-negocio.md` no está lo que necesitás, parás y consultás.

## El revisor lee el diff, no el informe

**Cómo se acumuló la deuda oculta:** el chat asesor revisaba informes de cierre de tarea. Los informes decían "funciona", "quedó verificado", "cobertura al 92%". Los diffs decían otra cosa (endpoint que devolvía 200 hardcodeado, prueba que instanciaba el servicio con mocks de todo). Nadie miró el diff.

**Regla:** cuando una tarea cierra, el revisor abre `git diff` primero y lo lee entero. El informe se lee después, y solo para entender el porqué de las decisiones que el diff no explica.

**Regla derivada:** los informes son de máximo 30 líneas. Un informe largo es un lugar donde se esconden cosas.

## Respaldo antes de tocar dinero

**El día que se rompió la migración 0007:** día 12 del proyecto. La migración se marcó como aplicada en la tabla `_prisma_migrations` sin haberse aplicado realmente. El backend arrancó bien, pero al intentar registrar el primer pago simulado, murió porque una columna no existía. **No había respaldo funcionando**; había que confiar en que Neon guardaba algo.

**Regla derivada:** el respaldo se prueba (generado + restaurado en un entorno de prueba) antes de la rebanada que empieza a tocar dinero. En este proyecto, antes de la rebanada 2.

**Regla derivada:** el comando de migración de producción exige teclear el nombre del host para confirmar, y la aplicación al arrancar verifica que la migración esperada está aplicada y falla ruidosamente si no.

## No arreglás lo ajeno, pero alguien tiene que arreglarlo

**Lo que funcionó a medias del proyecto anterior:** la regla "el chat de tarea no arregla lo que encuentra fuera de su alcance, lo anota en `pendientes.md`". Evitó que las tareas se descarrilaran.

**Lo que no funcionó:** nadie tenía como tarea limpiar `pendientes.md`. Al final del proyecto tenía 74 hallazgos abiertos. La deuda se acumuló silenciosamente.

**Regla:** cada dos rebanadas cerradas, se agenda una tarea de "pago de deuda" cuyo alcance es resolver hallazgos de `pendientes.md`. Ver `rebanadas.md`.

## Decisiones que sí funcionaron y no se cambian

Del proyecto anterior, estas decisiones se conservan porque no se rompieron:

- **Modelado de la orden con campos congelados** (decisiones 20-27 de la retrospectiva anterior). Cada orden guarda copia de los valores que le corresponden al momento de crearla: % de comisión, rango, nombre + precio de ítem. Nunca hubo un bug de "cambié el precio y ahora las órdenes viejas están mal".
- **Cálculo de comisión sobre precio de lista, no cobrado** (decisión 21). Nunca hubo confusión sobre a cuánto tiene derecho el lavador.
- **Dinero en enteros centavos.** Sin `Float`, cero bugs de redondeo.
- **Función única de "día operativo".** Nunca hubo dos partes del sistema desacordadas sobre a qué día pertenece una orden.
- **Ítem N:1 con orden, pago N:1 con orden.** Permite cobros parciales y múltiples métodos de pago sin problemas.

Estas cinco decisiones son las bases que hacen posible el nuevo intento. No se re-abren.

## Métricas del proyecto anterior

Para poner en contexto lo que pasó:

| Métrica | Valor |
|---|---|
| Días trabajados | 21 |
| Commits | 154 |
| Líneas de código | 39.500 |
| Líneas de informes de cierre | 12.455 |
| Tareas completadas | 47 |
| Tareas revertidas | 4 |
| Órdenes reales creadas por Carlos | 0 |
| Deuda técnica atribuible a multi-tenant | 71% |

**Lo importante no es que estaba mal el código; es que no se terminó ninguna feature usable en 21 días.** Este intento se organiza al revés: primero se termina la primera feature usable (rebanada 1), después la segunda, y así, con Carlos usándolas a medida que salen.

---

## Nota sobre D-28: contradicción explícita con este documento

Este documento describe por qué las rebanadas verticales (backend + frontend por feature) evitan los errores del proyecto anterior. **La decisión D-28 en `decisiones.md` contradice esa lección deliberadamente:** el proyecto se construye con todo el frontend primero y el backend después.

La contradicción se acepta por una razón registrada allí: bajar el estrés del backend para sostener el proyecto en el tiempo. Se aceptó porque una decisión más "correcta" que no se sostiene en el tiempo es peor que una decisión imperfecta que sí se sostiene.

**Señales de alarma durante Fase 1:** si a mitad del frontend aparecen supuestos de dominio que los mocks están escondiendo — comportamientos que "el backend real tendría que decidir" pero el mock deja pasar sin preguntar — hay que pausar y consultar a David antes de seguir. Ese es exactamente el error que este documento describe, y el que D-28 asume como riesgo.

**Al cerrar Fase 1**, este documento vuelve a ser la referencia principal: las rebanadas de F2 son verticales, tienen que ir a producción una por una, y respetan todas las reglas de método que este documento defiende.
