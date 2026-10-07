# Glosario

Vocabulario del proyecto. Usar estos términos consistentemente en código, comentarios, documentos y conversaciones. Si un concepto tiene dos formas de nombrarse en Colombia, se elige una y se registra acá.

## Roles y personas

**Superadmin** — David, dueño del sistema completo. Su cuenta no pertenece a ningún negocio (`Usuario.negocio_id = null`). Por ahora sus operaciones (crear negocio, suspender, etc.) se hacen por script, no por panel web.

**Dueño (Dueno)** — el propietario de un lavadero. Carlos es el dueño de Medallo Bikes. Tiene el rol `DUENO` en la base. Puede hacer todo lo que hace el operador y además configurar el negocio, ver reportes, cerrar caja, aplicar cortesías y anular órdenes.

**Operador** — persona en la recepción del lavadero que recibe motos, cobra y entrega. Tiene el rol `OPERADOR`. No puede aplicar descuentos ni ver reportes financieros.

**Trabajador / Lavador** — la persona que efectivamente lava las motos. **No es un usuario del sistema**: no tiene contraseña ni inicia sesión. Existe como fila en la tabla `Trabajador` para que se le pueda asignar comisiones. En código y en la interfaz usamos "trabajador" para ser consistentes con la tabla.

## Estructura del negocio

**Negocio** — un lavadero individual. Cada negocio es un tenant lógico del sistema. Hoy hay uno solo: Medallo Bikes.

**Rango de cilindraje** — un intervalo de motos con un mismo grupo de precios. Ejemplos: "Hasta 200cc", "201-500cc", "501cc en adelante". Cada negocio define los suyos.

**Servicio** — algo que se puede cobrar. Dos tipos: `PAQUETE` (Básico, Full) que agrupa varios trabajos, y `ADICIONAL` (Brillado de farola, Limpieza de escape) que se compra aparte.

**Paquete** — un `Servicio` de tipo `PAQUETE`. En las tarjetas de Medallo Bikes son "Servicio General - Básico" y "Servicio Detallado - Full".

**Adicional** — un `Servicio` de tipo `ADICIONAL`. Se cobra aparte del paquete, tiene precio por rango.

**Precio** — un monto en centavos asociado a un par (servicio, rango de cilindraje). Configurable por el dueño.

**Acuerdo de comisión** — el porcentaje pactado entre dueño y un trabajador específico, con fecha de inicio y fecha de fin. Un trabajador tiene N acuerdos históricos y uno solo vigente (con `fecha_fin = null`).

## La orden y su vida

**Orden** — el registro de "una lavada": una moto que llegó, se lavó, se cobró y se entregó. Es el objeto central del sistema.

**Ítem de la orden** — un servicio dentro de una orden, con nombre y precio congelados. Una orden tiene N ítems (un paquete + adicionales).

**Estado de la orden** — dónde está la orden en su ciclo de vida: `CREADA`, `LAVANDO`, `LISTA`, `COBRADA`, `ENTREGADA`, `ANULADA`. Ver `reglas-negocio.md` para el flujo.

**Congelar** — copiar un valor al momento de crear la orden (o el ítem) para que cambios posteriores en el catálogo no afecten registros históricos. Los cuatro campos congelados están definidos en `CLAUDE.md`.

**Cortesía** — orden donde no se cobra (regalo al cliente). El lavador cobra su comisión igual, calculada sobre el precio de lista. Requiere motivo obligatorio.

**Anulación** — dejar una orden sin efecto. No borra la orden ni sus registros; solo cambia el estado a `ANULADA` con motivo obligatorio.

**Reemplazo** — cuando se anula una orden y se crea una nueva para corregir (típicamente porque se cobró un paquete equivocado). La nueva orden tiene `orden_reemplaza_id` apuntando a la anulada.

## Dinero

**Peso colombiano (COP)** — moneda del sistema. Todos los montos son en centavos de peso.

**Centavos** — la unidad de todos los campos de dinero. Un peso son 100 centavos. Los nombres de campos llevan sufijo `_centavos` para evitar confusiones.

**Precio de lista** — el `precio_centavos` en la tabla `Precio`, para un (servicio, rango) dado, en el momento en que se armó la orden. Sobre este precio se calcula la comisión, sin importar lo cobrado.

**Excedente** — cuando el pago total supera la suma de ítems. Requiere `concepto` en el pago.

**Comisión** — porcentaje del precio de lista que le corresponde al lavador. Se expresa en enteros base-100 (`5000` = 50.00%).

## Tiempo

**Día operativo** — la fecha calendario a la que pertenece una orden o un pago para propósitos de reporte y cierre de caja. Se calcula con una función única en `packages/shared`. Ver `reglas-negocio.md`.

**Cierre de caja** — el acto de terminar el día operativo. Se compara el total esperado (calculado) con el total reportado (ingresado a mano). Un cierre por día por negocio.

**Período** — una unidad de agregación para reportes: día, semana o mes. Todos los períodos se definen sobre el día operativo, no sobre la fecha calendario cruda.

## Técnico

**Repositorio** — la capa que arma consultas Prisma. Es la ÚNICA capa que aplica el filtro por `negocio_id`.

**Servicio (de código)** — la capa de lógica de dominio en el backend. Distinto del `Servicio` del negocio (paquete/adicional); el contexto suele desambiguarlo.

**Controlador** — la ruta HTTP en Fastify. Valida el request con Zod, llama al servicio, devuelve el response.

**Módulo** — una carpeta bajo `apps/api/src/modulos/<nombre>` que agrupa controlador, servicio, repositorio y esquemas de un dominio.

**Rebanada** — una unidad de trabajo que entrega funcionalidad usable de punta a punta. Ver `metodologia.md` y `rebanadas.md`.

**Prueba E2E** — prueba de Playwright que ejerce el flujo completo desde el navegador. Cada rebanada tiene al menos una.

**Keep-alive** — un ping externo (cron-job.org) que llega a `/api/salud` cada 10 minutos para evitar que Render suspenda el proceso por inactividad.

**Arranque en frío** — el tiempo (~50s) que tarda el backend en responder tras estar suspendido por inactividad. Mitigado por keep-alive.
