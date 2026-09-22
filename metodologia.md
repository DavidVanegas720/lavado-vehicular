# Metodología de trabajo

Este documento describe cómo se estructura el trabajo entre David, el chat arquitecto y los chats de tarea. Viene directo del análisis del proyecto anterior; los errores del método están documentados en `lecciones-proyecto-anterior.md`.

## Los tres actores

**David** — dueño del sistema, dueño de las decisiones de producto y de las decisiones técnicas. Aprueba planes antes de que se implementen. Puede consultar al chat arquitecto cuando quiera.

**Chat arquitecto** — un chat abierto en Claude Code, con `PROMPT-INICIAL.md` cargado como primer mensaje. Toma decisiones técnicas, redacta prompts de tarea, revisa el diff cuando una tarea cierra. **No implementa código.** Consulta a David antes de cerrar decisiones importantes.

**Chat de tarea** — un chat nuevo por rebanada, abierto en Claude Code, que recibe un prompt específico del arquitecto y ejecuta la implementación completa: base → API → pantalla → verificado en navegador. Cierra con informe corto + diff.

## Reglas del chat arquitecto

- Antes de responder cualquier cosa, lee `CLAUDE.md` y los documentos apuntados desde ahí.
- No inventa reglas de negocio: si algo no está en `reglas-negocio.md`, pregunta a David.
- No implementa código. Si le piden implementar, redacta un prompt de tarea y explica que un chat aparte lo hará.
- Antes de cerrar una decisión, la explica y pide aprobación explícita.
- Cuando aprueba un plan, su entregable es un prompt de tarea listo para pegar en un chat nuevo.
- Cuando revisa el cierre de una tarea, **lee el diff, no el informe.** El informe queda solo para el porqué de las decisiones.
- Actualiza `docs/decisiones.md` cuando David aprueba una decisión nueva. No lo hace por su cuenta.

## Reglas del chat de tarea

- Antes de tocar código, lee `CLAUDE.md`, el prompt de la tarea, y los documentos que el prompt referencia.
- Escribe el plan aprobado en `.plan/<tarea>.md` antes de la primera línea de código.
- No toma decisiones de producto ni cambia decisiones ya tomadas. Si encuentra una ambigüedad, para y consulta.
- No expande el alcance. Si en el camino aparece una mejora tentadora que no está en el prompt, la anota en `pendientes.md` y sigue con la tarea original.
- Termina la tarea con una prueba E2E que ejercita el flujo principal de la rebanada.
- Verifica en navegador antes de considerar la tarea terminada.
- Cierra con un informe de máximo 30 líneas.

## Formato de una rebanada

Una rebanada es una unidad de trabajo que entrega funcionalidad **usable de punta a punta** por un usuario real. No es "el backend de X". No es "las pantallas de Y". Es "el usuario puede hacer Z".

Ejemplos correctos:
- "Carlos entra al sistema, registra una moto, y la ve en el tablero del día."
- "Carlos cobra una orden en efectivo y la marca entregada."

Ejemplos incorrectos:
- "Modelo de base para órdenes" (no entrega nada al usuario).
- "Pantalla de listado de motos" (no funciona sin backend).
- "Endpoint POST /ordenes" (no funciona sin pantalla).

La lista de rebanadas en orden está en `rebanadas.md`.

## Formato del prompt de tarea

Cuando el arquitecto redacta un prompt para un chat de tarea, tiene esta estructura:

```
# Tarea: <slug-corto>

## Rebanada a la que pertenece
<referencia a rebanadas.md>

## Objetivo
Una frase. Qué tiene que poder hacer un usuario al terminar.

## Criterio de aceptación
Lista de puntos verificables. El más importante es siempre el
E2E con Playwright que ejerce el flujo.

## Documentos que hay que leer antes de empezar
- CLAUDE.md
- docs/arquitectura.md
- <los que apliquen a la tarea>

## Alcance
Qué SÍ se toca. Qué NO se toca.

## Decisiones ya tomadas
Referencia a docs/decisiones.md por tema.

## Preguntas abiertas
Si hay algo sin decidir, se lista acá y se para hasta que David responda.
```

## Formato del informe de cierre

Máximo 30 líneas totales. No más.

```markdown
# Cierre: <tarea>

## Qué quedó funcionando
- (bullets breves, uno por criterio de aceptación cumplido)

## Qué decidí en el camino y por qué
- (decisiones técnicas menores que no ameritan ADR, con su razón)

## Qué quedó a medias
- (nada quedó a medias) O (lista breve con motivo)

## Qué encontré que no era mío
- Registrado en pendientes.md como H-XX (una línea por hallazgo)

## Prueba E2E
- Ubicación: <ruta al archivo>
- Corre localmente: sí/no
- Corre en CI: sí/no
```

## Formato de un hallazgo en `pendientes.md`

Máximo 10 líneas. Si necesita más, es una tarea, no un hallazgo.

```markdown
## H-XX — <título de una línea>

**Qué es:** una o dos líneas.
**Qué se rompe si nadie lo atiende:** una línea concreta.
**Cuándo se descubrió:** fecha + tarea.
**Estado:** abierto / en curso / cerrado.
```

## Cierre de tarea: qué revisa el arquitecto

Cuando el chat de tarea informa que cerró, el arquitecto **lee el diff en git**, no el informe. Pasos:

1. Corre `git diff main..HEAD` o similar y lee el diff completo.
2. Verifica que la prueba E2E existe y ejerce el flujo real.
3. Compara los archivos tocados contra el alcance del prompt. Si tocó cosas fuera del alcance sin justificación, pregunta antes de aprobar.
4. Verifica que `pendientes.md` tenga las entradas nuevas si el informe menciona hallazgos ajenos.
5. Solo entonces lee el informe, y lo usa para entender el porqué de las decisiones no obvias.

## Cuándo NO seguir el método

El método existe para reducir errores. Cuando el método mismo se vuelve el error, hay que cambiarlo.

Casos donde vale la pena romperlo:
- Un cambio de una línea en un texto de una pantalla — no amerita un chat de tarea. David lo hace directo.
- Un error de ortografía en un mensaje de error — igual.
- Un experimento local para probar una librería — no genera artefactos, no amerita el ciclo.

Regla: si la tarea no cambia el sistema desplegado ni la deuda del proyecto, no hace falta el ciclo completo. Todo lo demás sí.

## Anti-patrones documentados del proyecto anterior

Estos son errores que ya se cometieron. No repetirlos. Ver `lecciones-proyecto-anterior.md` para el detalle.

1. **"Hecha" significando "commiteada".** Una tarea no está hecha si su feature no está funcionando en producción. Respaldo con código escrito pero sin bucket configurado NO es respaldo.
2. **Partir tareas horizontalmente.** "Yo hago el backend, después alguien hace la pantalla" produce backends huérfanos.
3. **Escribir un requisito sin preguntarle al dueño.** El caso T-018 del proyecto anterior: se asumió una política de devoluciones, se construyó, y nueve días después el dueño dijo lo contrario.
4. **Confiar en el informe en vez del diff.** El informe es lo que el implementador cree que hizo. El diff es lo que hizo.
5. **Acumular deuda sin una tarea que la pague.** La regla "no arreglás lo ajeno" solo funciona con su contraparte: hay que agendar tareas de pago de deuda cada N rebanadas.
