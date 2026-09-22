# Lavado Vehicular — Instrucciones para Claude Code

Sistema para lavaderos de motos en Colombia. Único negocio hoy: **Medallo Bikes**, primer usuario del sistema. **No paga por el sistema todavía**: eso significa que corremos en capa gratuita, y esa es una restricción de diseño real, no una preferencia. El sistema pasa a plan pago el día que alguien pague por usarlo.

Este archivo se carga en cada tarea. Al empezar cualquier trabajo, además de este archivo tenés que leer los documentos apuntados abajo según lo que la tarea toque. No asumas nada sobre el proyecto sin haber leído los documentos correspondientes.

## Documentos del proyecto

- `docs/arquitectura.md` — stack, capas, módulos, deploy. **Leer siempre.**
- `docs/convenciones-codigo.md` — nombres, estructura, patrones, formato. **Leer siempre.**
- `docs/modelo-datos.md` — esquema de la base y reglas de congelamiento. Leer en tareas que tocan persistencia.
- `docs/reglas-negocio.md` — roles, ciclo de vida de la orden, reglas de dinero. **Leer siempre.**
- `docs/seguridad.md` — checklist de 20 reglas de seguridad clasificada. Leer en tareas de auth, input, endpoints o despliegue.
- `docs/metodologia.md` — cómo se abren y cierran tareas, qué cuenta como "hecho". **Leer siempre.**
- `docs/rebanadas.md` — plan de rebanadas verticales. La tarea actual pertenece a una.
- `docs/decisiones.md` — todas las decisiones ya tomadas, con su porqué. Buscar acá antes de proponer cambiar una.
- `docs/glosario.md` — vocabulario del negocio.
- `docs/pendientes.md` — deuda técnica y preguntas abiertas. Leer al empezar y actualizar al terminar.
- `docs/lecciones-proyecto-anterior.md` — errores documentados del proyecto anterior. Leer al empezar cada rebanada.

## Los dos roles de chat

**Chat arquitecto** — toma decisiones, escribe prompts para chats de tarea, revisa el diff cuando la tarea cierra. **No implementa código.** Consulta a David antes de cerrar una decisión importante. Su entregable es un prompt listo para pegar en un chat de tarea, no código.

**Chat de tarea** — implementa una rebanada vertical siguiendo un prompt escrito por el arquitecto. No toma decisiones de producto. No cambia decisiones ya tomadas sin consultar. Cierra con un informe corto (máx. 30 líneas) y un diff que se revisa como diff, no como informe.

## Las seis reglas no negociables del dominio

1. **Dinero en enteros, en centavos.** Nunca `float`, nunca `decimal` implícito, nunca strings sin transformar. Un peso son 100.
2. **La comisión al lavador se calcula sobre el precio de lista del servicio, no sobre lo cobrado.** Si hay descuento o cortesía, el descuento lo absorbe el negocio, no el lavador. Al lavador se le paga sobre lo que valía la lavada.
3. **Cuatro campos se congelan en la orden al momento de crearla:** porcentaje de comisión del lavador, rango de cilindraje elegido, trabajador asignado, y nombre + precio de cada ítem. Congelar significa copiar el valor, no referenciarlo.
4. **El filtro por `negocio_id` vive solo en la capa de repositorio.** Controlador y servicio pasan siempre por el repositorio.
5. **Una sola función calcula el "día operativo"** para toda la aplicación. Reportes, cierres y consultas se pegan a esa función.
6. **Nada se borra.** Anular no borra, agrega un evento. Editar un precio no toca las órdenes viejas. Cambiar el porcentaje de un lavador no toca las órdenes viejas.

## Qué NO construir

Lista negra explícita. Si una tarea propone algo de esta lista, se rechaza y se consulta a David antes de continuar. El porqué de cada prohibición está en `docs/lecciones-proyecto-anterior.md` y en `docs/decisiones.md`.

- Panel de SuperAdmin en interfaz web.
- Feature flags por negocio.
- Métricas de plataforma (cuántos negocios hay, quién está por vencer suscripción, etc.).
- Gestión de planes de suscripción, pasarela de pago, facturación al dueño de negocio.
- RLS (Row-Level Security) de PostgreSQL o roles múltiples de base de datos.
- Autenticación de plataforma paralela a la de negocio.
- Devoluciones de dinero de cualquier tipo, bajo cualquier rol.
- Matriz configurable de permisos por rol. Los tres roles (superadmin, dueño, operador) están codificados como enum.
- Registro público / auto-onboarding de negocios.
- Lavado de carros como flujo separado. El modelo de datos lo permite (columna `tipo` en vehículos, flag `acepta_carros` en negocio), la interfaz todavía no.

Todo esto se puede agregar más adelante. Nada de esto se construye ahora.

## Métodos de trabajo obligatorios

Vienen del análisis del proyecto anterior. No son sugerencias.

- **Rebanadas verticales, no capas horizontales.** Una tarea entrega base → API → pantalla → verificado en navegador. Prohibido "solo el backend, la pantalla después".
- **Excepción explícita para Fase 1 (D-28):** durante F1, la "rebanada vertical" se redefine como N vistas conectadas a la capa de mocks + verificadas en navegador en móvil/tablet/desktop. La integración con backend real es Fase 2. Esto contradice deliberadamente la lección de rebanadas verticales del proyecto anterior; ver D-28 en `decisiones.md` para la razón y el riesgo asumido.
- **Nada se marca como hecho sin verificación en navegador cuando hay pantalla.** No basta con que las pruebas pasen. Durante F1, verificación incluye las tres anchuras (375px, 768px, 1280px+) y el modo con `prefers-reduced-motion`.
- **El informe de cierre tiene un tope de 30 líneas.** El valor está en "qué decidí y por qué", "qué quedó a medias", "qué encontré que no era mío". Todo lo demás se lee en el código.
- **Los hallazgos en `pendientes.md` tienen un tope de 10 líneas.** Un hallazgo que necesita más es una tarea, no una nota.
- **Antes de escribir que algo no existe o que algo falla, verificar en el código**, no en los informes ni en la memoria.
- **El revisor lee el diff, no el informe.** El informe queda para lo que el diff no cuenta: el porqué de decisiones y qué se descartó.

## Antes de escribir el primer commit de una tarea

1. Leer `docs/rebanadas.md` y ubicar la tarea.
2. Leer los documentos relevantes según la lista de arriba.
3. Escribir el plan aprobado en un archivo (`.plan/<tarea>.md`) antes de la primera línea de código.
4. Si la tarea toca algo que este archivo prohíbe, o encuentra una decisión sin tomar en `pendientes.md`, parar y consultar a David.

## Antes de cerrar una tarea

1. Verificar en navegador si hay pantalla involucrada.
2. Escribir el informe de cierre (máximo 30 líneas).
3. Registrar en `pendientes.md` cualquier hallazgo que no correspondía a esta tarea, en menos de 10 líneas.
4. No marcar la tarea como hecha si el respaldo no está funcionando en producción, si el keep-alive no está corriendo, o si hay una cuenta de administrador con contraseña débil en producción.

## Comunicación con David

- No inflar respuestas. Ir al grano.
- Antes de asumir una regla de negocio, preguntar. La retrospectiva documenta un caso donde una tarea entera (T-018) se construyó sobre un supuesto que nunca se le preguntó al dueño, y hubo que anular todo.
- Si hay que elegir entre dos caminos técnicos y ambos son defendibles, explicar los dos y pedir decisión, no elegir por defecto.
