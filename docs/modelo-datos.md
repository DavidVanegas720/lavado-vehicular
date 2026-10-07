# Modelo de datos

Este documento define el esquema de la base de datos, con justificación por tabla y las reglas de congelamiento que no son obvias del esquema en sí.

## Principios generales

1. **Todo el dinero es entero, en centavos.** Nunca `Float`, nunca `Decimal`. Un peso son 100. El nombre del campo lleva el sufijo `_centavos` para que sea imposible confundirse.
2. **Todo `id` es UUID (`cuid()` de Prisma).** No autoincrementales. No leak de volumen ni de orden.
3. **Toda tabla tiene `created_at`** y, cuando aplica, `updated_at`. Nunca se borran filas: solo se marcan inactivas o se agregan eventos.
4. **El filtro por `negocio_id` es responsabilidad exclusiva del repositorio.** Todas las tablas del dominio (menos `usuarios` para superadmin) tienen la columna, y todas las consultas del repositorio la aplican automáticamente.
5. **Los cuatro campos congelados de la orden se copian, no se referencian.** Ver `reglas-negocio.md` para la lista.

## Esquema Prisma completo

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// PLATAFORMA (solo lo mínimo, sin construir panel de superadmin)
// ============================================================

model Negocio {
  id                String    @id @default(cuid())
  nombre            String
  activo            Boolean   @default(true)         // suspensión manual por superadmin (por ahora, vía script)
  acepta_carros     Boolean   @default(false)        // habilita el flujo de carros; solo superadmin lo cambia
  hora_apertura     Int       @default(8)            // hora local para día operativo
  hora_cierre       Int       @default(17)
  zona_horaria      String    @default("America/Bogota")
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  usuarios          Usuario[]
  trabajadores      Trabajador[]
  servicios         Servicio[]
  rangos_cilindraje RangoCilindraje[]
  vehiculos         Vehiculo[]
  ordenes           Orden[]
  cierres_caja      CierreCaja[]
}

// ============================================================
// USUARIOS Y ROLES
// ============================================================

enum Rol {
  SUPERADMIN
  DUENO
  OPERADOR
}

model Usuario {
  id             String    @id @default(cuid())
  negocio_id     String?                            // null para SUPERADMIN
  email          String    @unique
  nombre         String
  password_hash  String
  rol            Rol
  activo         Boolean   @default(true)
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt

  negocio        Negocio?  @relation(fields: [negocio_id], references: [id])
  sesiones       Sesion[]
  eventos_orden  EventoOrden[]

  @@index([negocio_id])
}

model Sesion {
  token          String    @id                       // token opaco aleatorio
  usuario_id     String
  created_at     DateTime  @default(now())
  ultima_actividad DateTime @default(now())
  expira_at      DateTime

  usuario        Usuario   @relation(fields: [usuario_id], references: [id])

  @@index([usuario_id])
  @@index([expira_at])
}

// ============================================================
// TRABAJADORES Y ACUERDOS DE COMISIÓN
// ============================================================

model Trabajador {
  id             String    @id @default(cuid())
  negocio_id     String
  nombre         String
  activo         Boolean   @default(true)
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt

  negocio        Negocio                @relation(fields: [negocio_id], references: [id])
  acuerdos       AcuerdoComision[]
  ordenes        Orden[]

  @@index([negocio_id])
}

// Un trabajador tiene N acuerdos en el tiempo. Solo uno con fecha_fin = null.
// Cambiar el porcentaje: cierra el actual con la fecha de hoy y crea uno nuevo.
model AcuerdoComision {
  id                  String    @id @default(cuid())
  trabajador_id       String
  porcentaje_base     Int                              // 0..10000 (0.00% a 100.00%)
  fecha_inicio        DateTime
  fecha_fin           DateTime?                        // null = vigente
  created_at          DateTime  @default(now())

  trabajador          Trabajador @relation(fields: [trabajador_id], references: [id])

  @@index([trabajador_id])
}

// ============================================================
// CATÁLOGO (configurable por el dueño del negocio)
// ============================================================

model RangoCilindraje {
  id                     String    @id @default(cuid())
  negocio_id             String
  nombre                 String                        // "Hasta 200cc", "201-500cc", "501cc en adelante"
  cc_min                 Int                           // 0 para el primero
  cc_max                 Int?                          // null para el último ("en adelante")
  orden_visualizacion    Int
  activo                 Boolean   @default(true)
  created_at             DateTime  @default(now())
  updated_at             DateTime  @updatedAt

  negocio                Negocio   @relation(fields: [negocio_id], references: [id])
  precios                Precio[]
  ordenes                Orden[]

  @@index([negocio_id])
}

enum TipoServicio {
  PAQUETE       // "Servicio General - Básico", "Servicio Detallado - Full"
  ADICIONAL     // "Brillado de farola", "Limpieza de escape"
}

model Servicio {
  id             String    @id @default(cuid())
  negocio_id     String
  tipo           TipoServicio
  nombre         String
  descripcion    String?                              // "Lavado con shampoo ph neutro..."
  activo         Boolean   @default(true)
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt

  negocio        Negocio   @relation(fields: [negocio_id], references: [id])
  precios        Precio[]
  items_orden    ItemOrden[]

  @@index([negocio_id])
}

// Un precio por (servicio, rango). Cuando el dueño sube un precio, se actualiza esta fila.
// Las órdenes ya creadas no se ven afectadas (el precio se copia al ítem).
model Precio {
  id                     String    @id @default(cuid())
  servicio_id            String
  rango_cilindraje_id    String
  precio_centavos        Int
  created_at             DateTime  @default(now())
  updated_at             DateTime  @updatedAt

  servicio               Servicio         @relation(fields: [servicio_id], references: [id])
  rango                  RangoCilindraje  @relation(fields: [rango_cilindraje_id], references: [id])

  @@unique([servicio_id, rango_cilindraje_id])
}

// ============================================================
// VEHÍCULOS
// ============================================================

enum TipoVehiculo {
  MOTO
  CARRO       // preparado en el modelo, no en el flujo (ver reglas-negocio.md)
}

model Vehiculo {
  id                   String    @id @default(cuid())
  negocio_id           String
  tipo                 TipoVehiculo    @default(MOTO)
  placa                String
  cilindraje           Int?                          // null si es carro (por ahora nada de carros)
  primer_ingreso       DateTime  @default(now())
  updated_at           DateTime  @updatedAt

  negocio              Negocio   @relation(fields: [negocio_id], references: [id])
  ordenes              Orden[]

  @@unique([negocio_id, placa])
  @@index([negocio_id])
}

// ============================================================
// ÓRDENES (núcleo del dominio)
// ============================================================

enum EstadoOrden {
  CREADA            // recién ingresada, sin lavador aún o con lavador asignado
  LAVANDO           // el lavador la agarró
  LISTA             // terminó de lavarse
  COBRADA           // se registró el pago
  ENTREGADA         // se entregó al cliente
  ANULADA           // se anuló (nada se borra)
}

model Orden {
  id                              String    @id @default(cuid())
  negocio_id                      String
  vehiculo_id                     String
  trabajador_id                   String?                      // null hasta que se asigne
  operador_id                     String                       // quién ingresó la moto
  rango_cilindraje_id             String

  // --- Los cuatro campos congelados de la comisión y el rango ---
  porcentaje_comision_congelado   Int                          // copiado del acuerdo vigente al crear la orden
  rango_cilindraje_nombre_congelado String                     // copiado por si el rango cambia de nombre
  // (el trabajador_id ya es una referencia; el nombre + porcentaje congelado hacen la comisión trazable)

  estado                          EstadoOrden @default(CREADA)
  es_cortesia                     Boolean   @default(false)
  motivo_cortesia                 String?                       // obligatorio si es_cortesia = true
  motivo_anulacion                String?                       // obligatorio si estado = ANULADA
  orden_reemplaza_id              String?                       // si esta orden reemplaza a una anulada (caso "cobré mal el servicio")

  dia_operativo                   DateTime  @db.Date            // calculado por la función única al crear
  created_at                      DateTime  @default(now())
  fecha_asignacion                DateTime?
  fecha_lavando                   DateTime?
  fecha_lista                     DateTime?
  fecha_cobro                     DateTime?
  fecha_entrega                   DateTime?
  fecha_anulacion                 DateTime?

  negocio                         Negocio          @relation(fields: [negocio_id], references: [id])
  vehiculo                        Vehiculo         @relation(fields: [vehiculo_id], references: [id])
  trabajador                      Trabajador?      @relation(fields: [trabajador_id], references: [id])
  rango_cilindraje                RangoCilindraje  @relation(fields: [rango_cilindraje_id], references: [id])
  items                           ItemOrden[]
  pagos                           Pago[]
  eventos                         EventoOrden[]

  @@index([negocio_id, dia_operativo])
  @@index([negocio_id, estado])
  @@index([vehiculo_id])
}

model ItemOrden {
  id                        String    @id @default(cuid())
  orden_id                  String
  servicio_id               String

  // --- Los dos campos congelados del servicio ---
  servicio_nombre_congelado String                              // copiado de Servicio.nombre al agregar
  precio_centavos_congelado Int                                 // copiado de Precio.precio_centavos al agregar

  created_at                DateTime  @default(now())

  orden                     Orden     @relation(fields: [orden_id], references: [id])
  servicio                  Servicio  @relation(fields: [servicio_id], references: [id])

  @@index([orden_id])
}

enum MetodoPago {
  EFECTIVO
  QR
  OTRO
}

model Pago {
  id               String    @id @default(cuid())
  orden_id         String
  monto_centavos   Int
  metodo           MetodoPago
  concepto         String?                                        // obligatorio si el total de pagos > total de ítems (excedente)
  dia_operativo    DateTime  @db.Date
  created_at       DateTime  @default(now())

  orden            Orden     @relation(fields: [orden_id], references: [id])

  @@index([orden_id])
  @@index([dia_operativo])
}

enum TipoEventoOrden {
  CREADA
  ASIGNADA
  LAVANDO
  LISTA
  COBRADA
  ENTREGADA
  ANULADA
  ITEM_AGREGADO
  COMENTARIO
}

model EventoOrden {
  id             String    @id @default(cuid())
  orden_id       String
  tipo           TipoEventoOrden
  usuario_id     String
  datos_json     Json?                                            // detalles específicos del evento
  created_at     DateTime  @default(now())

  orden          Orden     @relation(fields: [orden_id], references: [id])
  usuario        Usuario   @relation(fields: [usuario_id], references: [id])

  @@index([orden_id])
}

// ============================================================
// CIERRE DE CAJA
// ============================================================

model CierreCaja {
  id                       String    @id @default(cuid())
  negocio_id               String
  dia_operativo            DateTime  @db.Date
  total_esperado_centavos  Int                                    // calculado por el sistema
  total_reportado_centavos Int                                    // ingresado a mano por el operador/dueño
  diferencia_centavos      Int                                    // calculado: reportado - esperado
  notas                    String?
  cerrado_por_usuario_id   String
  created_at               DateTime  @default(now())

  negocio                  Negocio   @relation(fields: [negocio_id], references: [id])

  @@unique([negocio_id, dia_operativo])
  @@index([negocio_id])
}
```

## Reglas de congelamiento

Los "cuatro campos congelados" de la regla 3 de `CLAUDE.md` se materializan así:

1. **Porcentaje de comisión del lavador** → `Orden.porcentaje_comision_congelado` se copia del `AcuerdoComision` vigente del trabajador al crear la orden. Si el % cambia después, esta orden mantiene el que tenía.
2. **Rango de cilindraje** → `Orden.rango_cilindraje_id` referencia + `Orden.rango_cilindraje_nombre_congelado` copia. El id permite mantener la relación; el nombre congelado protege del rename.
3. **Trabajador asignado** → `Orden.trabajador_id` es una referencia. **El trabajador nunca se borra, solo se marca inactivo**, así que la referencia es estable. El porcentaje congelado lo trae la orden.
4. **Nombre y precio del ítem** → `ItemOrden.servicio_nombre_congelado` y `ItemOrden.precio_centavos_congelado` copian del servicio + precio al agregar el ítem.

## El "día operativo"

El día operativo es una fecha calendario (`@db.Date`, sin hora). Se calcula así:

- Si la creación cae entre `hora_apertura` (8) y `hora_cierre` (17) hora local del negocio → día = fecha calendario de hoy.
- Si cae antes de `hora_apertura` → día = fecha calendario de hoy (Carlos abre temprano).
- Si cae después de `hora_cierre` → **decisión pendiente en `pendientes.md`** (¿día de hoy o rechazo?).

La función vive **una sola vez** en `packages/shared/src/dominio/dia-operativo.ts`. Todos los reportes, cierres y consultas la usan. Nunca se calcula "a mano" en otro lado.

## Reglas de mutabilidad

- **Servicios y precios:** se pueden editar libremente. Los cambios no afectan órdenes ya creadas (los ítems tienen su copia).
- **Rangos de cilindraje:** se pueden editar en su nombre. `cc_min` y `cc_max` no se editan si ya hay órdenes que los usan (crear un rango nuevo y desactivar el viejo).
- **Trabajadores:** se marcan inactivos, nunca se borran. Órdenes viejas mantienen la referencia.
- **Acuerdos de comisión:** el vigente se cierra (`fecha_fin` = hoy) y se crea uno nuevo. Nunca se edita un acuerdo vigente en su porcentaje.
- **Órdenes:** una vez `COBRADA`, solo se puede pasar a `ENTREGADA` o `ANULADA`. **Anular una orden cobrada NO devuelve dinero** — es la regla explícita del negocio.
- **Pagos:** son inmutables. Se pueden anular con un evento que los marca revertidos, pero la fila queda.

## Índices

Los `@@index` del schema son intencionales. Los más importantes:

- `Orden(negocio_id, dia_operativo)` — todos los reportes filtran por esto.
- `Orden(negocio_id, estado)` — el tablero del día busca por estado.
- `Vehiculo(negocio_id, placa)` es único — impide duplicar placas en un mismo negocio, permite lookup rápido cuando el operador ingresa la placa.
- `Pago(dia_operativo)` — el cierre de caja lo consulta.
- `CierreCaja(negocio_id, dia_operativo)` único — impide dos cierres del mismo día.

## Migraciones

Cada migración de Prisma vive en `apps/api/prisma/migrations/`. El comando de deploy pasa por `pnpm db:migrar-prod`, que envuelve `prisma migrate deploy` con confirmación de host (ver `arquitectura.md`).
