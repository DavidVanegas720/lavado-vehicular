// Fixtures válidos compartidos por las pruebas de esquemas (no se importan fuera de *.test.ts).
const ahora = "2026-10-07T15:00:00.000Z";

export const fixtureNegocio = {
  id: "neg1",
  nombre: "Medallo Bikes",
  activo: true,
  acepta_carros: false,
  hora_apertura: 8,
  hora_cierre: 17,
  zona_horaria: "America/Bogota",
  created_at: ahora,
  updated_at: ahora,
};

export const fixtureUsuario = {
  id: "usu1",
  negocio_id: "neg1",
  email: "carlos@medallobikes.co",
  nombre: "Carlos",
  rol: "DUENO",
  activo: true,
  created_at: ahora,
  updated_at: ahora,
};

export const fixtureTrabajador = {
  id: "tra1",
  negocio_id: "neg1",
  nombre: "Juan",
  activo: true,
  created_at: ahora,
  updated_at: ahora,
};

export const fixtureAcuerdo = {
  id: "acu1",
  trabajador_id: "tra1",
  porcentaje_base: 5000,
  fecha_inicio: ahora,
  fecha_fin: null,
  created_at: ahora,
};

export const fixtureRango = {
  id: "ran1",
  negocio_id: "neg1",
  nombre: "Hasta 200cc",
  cc_min: 0,
  cc_max: 200,
  orden_visualizacion: 1,
  activo: true,
  created_at: ahora,
  updated_at: ahora,
};

export const fixtureServicio = {
  id: "ser1",
  negocio_id: "neg1",
  tipo: "PAQUETE",
  nombre: "Servicio General - Básico",
  descripcion: null,
  activo: true,
  created_at: ahora,
  updated_at: ahora,
};

export const fixturePrecio = {
  id: "pre1",
  servicio_id: "ser1",
  rango_cilindraje_id: "ran1",
  precio_centavos: 3_000_000,
  created_at: ahora,
  updated_at: ahora,
};

export const fixtureVehiculo = {
  id: "veh1",
  negocio_id: "neg1",
  tipo: "MOTO",
  placa: "ABC12D",
  cilindraje: 150,
  primer_ingreso: ahora,
  updated_at: ahora,
};

export const fixtureOrden = {
  id: "ord1",
  negocio_id: "neg1",
  vehiculo_id: "veh1",
  trabajador_id: "tra1",
  operador_id: "usu1",
  rango_cilindraje_id: "ran1",
  porcentaje_comision_congelado: 5000,
  rango_cilindraje_nombre_congelado: "Hasta 200cc",
  estado: "CREADA",
  es_cortesia: false,
  motivo_cortesia: null,
  motivo_anulacion: null,
  orden_reemplaza_id: null,
  dia_operativo: "2026-10-07",
  created_at: ahora,
  fecha_asignacion: null,
  fecha_lavando: null,
  fecha_lista: null,
  fecha_cobro: null,
  fecha_entrega: null,
  fecha_anulacion: null,
};

export const fixtureItemOrden = {
  id: "ite1",
  orden_id: "ord1",
  servicio_id: "ser1",
  servicio_nombre_congelado: "Servicio General - Básico",
  precio_centavos_congelado: 3_000_000,
  created_at: ahora,
};

export const fixturePago = {
  id: "pag1",
  orden_id: "ord1",
  monto_centavos: 3_000_000,
  metodo: "EFECTIVO",
  concepto: null,
  dia_operativo: "2026-10-07",
  created_at: ahora,
};

export const fixtureEvento = {
  id: "eve1",
  orden_id: "ord1",
  tipo: "CREADA",
  usuario_id: "usu1",
  datos_json: null,
  created_at: ahora,
};

export const fixtureCierre = {
  id: "cie1",
  negocio_id: "neg1",
  dia_operativo: "2026-10-07",
  total_esperado_centavos: 3_000_000,
  total_reportado_centavos: 2_950_000,
  diferencia_centavos: -50_000,
  notas: null,
  cerrado_por_usuario_id: "usu1",
  created_at: ahora,
};
