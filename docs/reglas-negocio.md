# Reglas de negocio

Este documento describe el dominio del sistema: cómo funciona un lavadero de motos por dentro, quién puede hacer qué, y cómo se comporta el dinero.

## El negocio en una frase

Un lavadero recibe motos, las lava, cobra, entrega, y a fin de día liquida comisiones a los lavadores. El sistema apoya ese flujo. Nada más.

## Los tres roles

Codificados como enum `Rol` en la base. **No son configurables.** Si Carlos algún día quiere un cuarto rol, se agrega un valor al enum, se codifican sus permisos, y se despliega. No hay matriz de permisos por rol.

### SUPERADMIN (David, el dueño del sistema)
- Puede crear, editar y suspender negocios. **Por ahora vía scripts (`pnpm crear-negocio`, `pnpm suspender-negocio`), no vía panel.** El panel se construye cuando exista un segundo negocio real.
- Puede habilitar `acepta_carros` en un negocio.
- No opera dentro de ningún negocio en particular; no crea órdenes ni cobra.
- Su `negocio_id` es `null`.

### DUENO (dueño del negocio, ej. Carlos de Medallo Bikes)
- Puede crear, editar y desactivar usuarios OPERADOR de su negocio.
- Puede crear, editar y desactivar trabajadores (lavadores).
- Puede negociar acuerdos de comisión con cada trabajador (crear uno nuevo, que cierra el anterior).
- Puede crear, editar y desactivar servicios, rangos de cilindraje y precios.
- Puede ver todos los reportes.
- Puede cerrar la caja del día.
- Puede aplicar cortesías y descuentos (con motivo obligatorio).
- Puede anular órdenes (con motivo obligatorio).
- Puede hacer todo lo que hace un OPERADOR.

### OPERADOR (recepción del lavadero)
- Ingresa vehículos y crea órdenes.
- Asigna lavador a la orden.
- Marca la orden como lavando / lista.
- Cobra órdenes.
- Entrega vehículos.
- **NO puede** aplicar cortesías ni descuentos.
- **NO puede** anular órdenes cobradas.
- **NO puede** ver reportes financieros ni cambiar precios.
- **NO puede** crear otros usuarios ni trabajadores.

## Los trabajadores (lavadores) no son usuarios

Un lavador es una entidad del sistema, no una cuenta. No tiene contraseña, no inicia sesión, no ve pantallas. Sirve para que el sistema sepa a quién asignarle la comisión de cada moto. Todas las acciones que involucran a un lavador (asignarlo a una orden, ver cuánto se le debe) las hace un OPERADOR o el DUENO desde su cuenta.

## Ciclo de vida de la orden

```
CREADA ──┬─→ LAVANDO ──→ LISTA ──→ COBRADA ──→ ENTREGADA
         │                            │
         └───────────────────────────→└─→ ANULADA
```

- **CREADA** — el operador registró la moto. Ya tiene rango, servicios elegidos, y trabajador asignado (o lo asigna a continuación).
- **LAVANDO** — alguien marcó que empezó a lavar. Puede ser el operador cuando el trabajador empieza, o el propio trabajador si en algún futuro se le da un tablero (hoy no).
- **LISTA** — terminó de lavarse, está esperando entrega.
- **COBRADA** — se registró al menos un pago que suma el total de ítems. Si el total pagado excede los ítems, el excedente exige un `concepto` en el pago (ver "Cobros por encima").
- **ENTREGADA** — el cliente se llevó la moto.
- **ANULADA** — la orden se anuló. Sigue en la base con `motivo_anulacion` obligatorio. **Anular una orden cobrada no devuelve dinero** (ver "Sin devoluciones").

## Las seis reglas no negociables del dinero

Repetidas de `CLAUDE.md`, pero explicadas acá:

### 1. Dinero en enteros, en centavos
Nunca `float`. Nunca `Decimal` a menos que Prisma lo obligue en algún caso, y aun así se convierte a entero antes de operar. Un peso son 100. Todos los cálculos son en centavos y solo se convierten a "20.000" para mostrar.

### 2. Comisión sobre precio de lista
Si un servicio vale $30.000 y se hace de cortesía (cobrado en $0) o con descuento (cobrado en $25.000), la comisión del lavador se calcula sobre **$30.000**, no sobre lo cobrado. El descuento o la cortesía los absorbe el negocio, no el trabajador.

**Ejemplo:** Full a $30.000, comisión al lavador 50%.
- Cliente paga $30.000 → al lavador le tocan $15.000.
- Cortesía a un amigo del dueño → al lavador le tocan igual $15.000.
- Descuento a $25.000 → al lavador le tocan igual $15.000. El negocio "pierde" $5.000, pero el trabajador está protegido de las negociaciones que hace el dueño.

### 3. Cuatro campos congelados en la orden
Ver `modelo-datos.md` para el detalle técnico. Los cuatro:
- Porcentaje de comisión del lavador (`Orden.porcentaje_comision_congelado`).
- Rango de cilindraje elegido (`Orden.rango_cilindraje_id` + nombre congelado).
- Trabajador asignado (`Orden.trabajador_id` — el trabajador no se borra, solo se marca inactivo).
- Nombre + precio de cada ítem (`ItemOrden.servicio_nombre_congelado` + `ItemOrden.precio_centavos_congelado`).

**Cuándo se congelan:**
- Porcentaje: al momento de crear la orden. Si el operador arma la orden a las 9am con lavador A al 50%, y a las 10am el dueño acuerda con A un nuevo % del 55%, esta orden mantiene el 50%.
- Rango: al crear la orden.
- Trabajador: al asignarlo (puede ser al crear o después).
- Ítem: al agregarlo a la orden.

### 4. Filtro por `negocio_id` solo en el repositorio
Ni el controlador ni el servicio filtran por `negocio_id` a mano. La capa de repositorio (`RepositorioBase` con métodos protegidos) lo aplica automáticamente en toda consulta. Ver `arquitectura.md`.

### 5. Una sola función de "día operativo"
Vive en `packages/shared/src/dominio/dia-operativo.ts`. Todos los reportes, cierres y consultas de "las órdenes de hoy" la usan. Nunca se calcula a mano.

Regla del cálculo:
- Horario del negocio: 8am a 5pm (configurable por negocio en `Negocio.hora_apertura` / `hora_cierre`).
- Orden creada dentro del horario → día operativo = fecha calendario de hoy.
- Orden creada antes de la apertura → día operativo = fecha calendario de hoy.
- Orden creada después del cierre → **decisión pendiente**, ver `pendientes.md`.

### 6. Nada se borra
- Un vehículo no se borra: si el operador se equivocó al ingresar la placa, se edita.
- Un trabajador no se borra: se marca inactivo. Sus órdenes viejas quedan trazables.
- Un servicio no se borra: se marca inactivo. Sus ítems viejos siguen mostrando el nombre congelado.
- Una orden no se borra: se anula (`estado = ANULADA` + motivo).
- Un pago no se borra: si hubo error, se agrega un evento que lo revierte, pero la fila queda.

## Cobros: casos concretos

### Caso normal
Cliente pide Full ($30.000). Operador crea orden con ítem Full. Cliente paga $30.000 en efectivo. Se registra un `Pago` con `monto = 30.000`, `metodo = EFECTIVO`. La orden pasa a `COBRADA`.

### Cliente paga por encima del total (propina, ajuste)
Cliente pide Full ($30.000) y paga $35.000, "por la propina" o "porque no tengo cambio". Se registra un `Pago` con `monto = 35.000`, `metodo = EFECTIVO`, y **`concepto` obligatorio** ("propina", "sin cambio", etc.). El sistema exige el concepto cuando el total pagado excede el total de ítems.

**Nota:** la comisión del lavador se calcula solo sobre el precio de lista de los ítems, no sobre el excedente. El excedente queda para el negocio.

### Servicio mal cobrado (elegido mal el paquete)
El cliente pagó por el Full ($30.000) pero era Básico ($20.000). El operador debe:
1. **Anular la orden actual** con motivo "servicio incorrecto seleccionado".
2. **Crear una orden nueva** con el servicio correcto y el pago correcto. El campo `orden_reemplaza_id` en la nueva orden apunta a la vieja para trazabilidad.
3. La compensación de la diferencia se maneja **fuera del sistema** (efectivo devuelto al cliente en la mano, o cobro adicional según el caso). El sistema no genera devolución.

**Pendiente:** confirmar con David si el pago de la orden anulada se marca "por acreditar a la nueva" o "efectivo ya recibido, no re-cobrar". Ver `pendientes.md`.

### Cortesía
El dueño le lava gratis a un amigo. El operador (o el dueño directamente) crea la orden con `es_cortesia = true` y `motivo_cortesia` obligatorio. Los ítems tienen su precio de lista normal en `precio_centavos_congelado`. **No se genera pago.** La orden puede pasar directo a `LISTA` → `ENTREGADA` sin pasar por `COBRADA`.

**La comisión al lavador se paga igual**, calculada sobre el precio de lista congelado en los ítems. Es la regla 2 aplicada al caso extremo.

### Descuento
Similar a cortesía pero parcial. El operador (dueño) marca el descuento en el pago con `concepto` obligatorio. El pago es menor al total de ítems. La orden pasa a `COBRADA` cuando lo pagado + descuento explícito iguala el total.

**Pendiente:** definir si el descuento es un campo aparte o si sale del `concepto` del pago. Ver `pendientes.md`.

## Sin devoluciones

**El sistema no permite devolver dinero a ningún rol, en ningún caso.** Es una regla explícita del negocio, no una limitación técnica: previene fraude interno.

- Si el cliente reclama porque le llovió después → no hay reembolso desde el sistema. Si Carlos decide compensarlo, lo hace en efectivo, en la mano, fuera del sistema.
- Si se cobró mal → se anula y se re-crea (ver arriba). El pago viejo queda registrado; la compensación es externa.

Esta regla es lo que hace que el modelo de datos se pueda simplificar: los pagos son inmutables, los totales cuadran con la suma, no hay estados intermedios de "reembolsado" que compliquen el cierre de caja.

## Un lavador por moto

Cada orden tiene un solo `trabajador_id`. Si dos lavadores lavan la moto juntos, la comisión se le paga solo al asignado en el sistema. El otro lavador puede ayudar porque quiere o porque lo pidió el dueño, pero no le corresponde comisión de esa moto. Es una regla explícita del negocio.

## Adicionales

Los servicios `ADICIONAL` (brillado de farola, limpieza de escape) se cobran aparte, solo si el cliente los pide, y tienen precio por rango de cilindraje igual que los paquetes. Se agregan como `ItemOrden` a la orden.

**Pendiente:** definir si se pueden agregar adicionales a una orden ya cobrada (moto está lista, el cliente pide extras). Ver `pendientes.md`.

## Reportes que el dueño necesita

Del pedido explícito:
- Diario: motos lavadas, dinero ingresado, comisión de cada lavador.
- Semanal: mismos totales agregados.
- Mensual: mismos totales agregados.

Los tres reportes se calculan a demanda desde las órdenes cobradas (no anuladas). El día operativo determina a qué período pertenece cada orden.

## Cierre de caja

Uno por día operativo por negocio (constraint único en la base). Al cerrar:
- El sistema calcula el `total_esperado_centavos` = suma de todos los pagos del día operativo.
- El operador o dueño ingresa el `total_reportado_centavos` (lo que efectivamente está en caja).
- El sistema calcula la `diferencia_centavos`. Si es distinta de cero, se puede cerrar igual pero queda la diferencia registrada.

**Pendiente:** definir si el cierre es obligatorio (bloquea la operación del día siguiente hasta cerrar) o flexible (se puede saltar). Ver `pendientes.md`.

## Carros (preparado, no construido)

El modelo tiene:
- `Negocio.acepta_carros` (default `false`, solo superadmin lo cambia).
- `Vehiculo.tipo` con valor `CARRO`.

**No hay servicios de carro, ni rangos, ni flujos de carro construidos.** El día que un dueño pida habilitar carros, hay que agregar servicios propios (que no son "cilindraje" sino algún equivalente para carros), y probablemente ajustar la pantalla de creación de orden. Ese trabajo se hace ese día, no ahora.
