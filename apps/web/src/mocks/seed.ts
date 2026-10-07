// Seed determinista de los mocks. Valores ficticios; los precios reales de Medallo Bikes los define Carlos.
import { z } from "zod";
import { centavos } from "@lavado-vehicular/shared/dominio/dinero";
import { calcularDiaOperativo } from "@lavado-vehicular/shared/dominio/dia-operativo";
import {
  esquemaPrecio,
  esquemaRangoCilindraje,
  esquemaServicio,
  type Precio,
  type RangoCilindraje,
  type Servicio,
} from "@lavado-vehicular/shared/esquemas/catalogo";
import { esquemaNegocio, type Negocio } from "@lavado-vehicular/shared/esquemas/negocio";
import {
  esquemaEventoOrden,
  esquemaItemOrden,
  esquemaOrden,
  esquemaPago,
  type EstadoOrden,
  type EventoOrden,
  type ItemOrden,
  type Orden,
  type Pago,
  type TipoEventoOrden,
} from "@lavado-vehicular/shared/esquemas/ordenes";
import {
  esquemaAcuerdoComision,
  esquemaTrabajador,
  type AcuerdoComision,
  type Trabajador,
} from "@lavado-vehicular/shared/esquemas/trabajadores";
import {
  esquemaUsuarioPublico,
  type UsuarioPublico,
} from "@lavado-vehicular/shared/esquemas/usuarios";
import { esquemaVehiculo, type Vehiculo } from "@lavado-vehicular/shared/esquemas/vehiculos";
import { crearAleatorio } from "./aleatorio";
import { idMock } from "./ids";

export interface EstadoMock {
  negocio: Negocio;
  usuarios: UsuarioPublico[];
  trabajadores: Trabajador[];
  acuerdos: AcuerdoComision[];
  rangos: RangoCilindraje[];
  servicios: Servicio[];
  precios: Precio[];
  vehiculos: Vehiculo[];
  ordenes: Orden[];
  items: ItemOrden[];
  pagos: Pago[];
  eventos: EventoOrden[];
}

const MS_DIA = 86_400_000;
const CONFIG_NEGOCIO = { zona_horaria: "America/Bogota", hora_apertura: 8, hora_cierre: 17 };

interface EspecOrden {
  estado: EstadoOrden;
  cobrada?: boolean; // solo ANULADA: se cobró antes de anular
  cortesia?: boolean;
  reemplazaALaPrimera?: boolean;
}

// En orden cronológico de creación: las anuladas primero, las CREADA al final.
const ESPECIFICACION: readonly EspecOrden[] = [
  { estado: "ANULADA", cobrada: true },
  { estado: "ANULADA" },
  { estado: "ENTREGADA" },
  { estado: "ENTREGADA" },
  { estado: "ENTREGADA", cortesia: true },
  { estado: "ENTREGADA" },
  { estado: "COBRADA" },
  { estado: "COBRADA" },
  { estado: "COBRADA" },
  { estado: "LISTA" },
  { estado: "LISTA" },
  { estado: "LISTA" },
  { estado: "LAVANDO", reemplazaALaPrimera: true },
  { estado: "LAVANDO" },
  { estado: "LAVANDO" },
  { estado: "LAVANDO" },
  { estado: "CREADA" },
  { estado: "CREADA" },
  { estado: "CREADA" },
  { estado: "CREADA" },
];

const iso = (ms: number): string => new Date(ms).toISOString();

/** Mismo `ahora` ⇒ mismo resultado. Todo se valida con los esquemas de shared. */
export function crearSeed(ahora: Date): EstadoMock {
  const aleatorio = crearAleatorio();
  const ahoraMs = ahora.getTime();
  const hace = (dias: number): number => ahoraMs - dias * MS_DIA;
  const baseCreacion = iso(hace(365));
  const diaDe = (ms: number) => calcularDiaOperativo(new Date(ms), CONFIG_NEGOCIO).dia;

  // P-A: se asume que el excedente de pago se registra con `concepto: "propina"`.
  const negocioId = idMock("neg", 1);
  const negocio = esquemaNegocio.parse({
    id: negocioId,
    nombre: "Medallo Bikes",
    activo: true,
    acepta_carros: false,
    ...CONFIG_NEGOCIO,
    created_at: baseCreacion,
    updated_at: baseCreacion,
  });

  const usuarios = z.array(esquemaUsuarioPublico).parse(
    (
      [
        [null, "superadmin@lavado.test", "Superadmin", "SUPERADMIN"],
        [negocioId, "carlos@medallobikes.test", "Carlos", "DUENO"],
        [negocioId, "operador@medallobikes.test", "Operador de turno", "OPERADOR"],
      ] as const
    ).map(([negocio_id, email, nombre, rol], i) => ({
      id: idMock("usr", i + 1),
      negocio_id,
      email,
      nombre,
      rol,
      activo: true,
      created_at: baseCreacion,
      updated_at: baseCreacion,
    })),
  );
  const operador = usuarios[2];
  if (!operador) throw new Error("Seed inconsistente: falta el operador.");

  const trabajadores = z.array(esquemaTrabajador).parse(
    ["Juan Pérez", "Andrés Gómez"].map((nombre, i) => ({
      id: idMock("trb", i + 1),
      negocio_id: negocioId,
      nombre,
      activo: true,
      created_at: baseCreacion,
      updated_at: baseCreacion,
    })),
  );

  const acuerdos = z.array(esquemaAcuerdoComision).parse([
    {
      id: idMock("acu", 1),
      trabajador_id: idMock("trb", 1),
      porcentaje_base: 5000,
      fecha_inicio: iso(hace(200)),
      fecha_fin: null,
      created_at: iso(hace(200)),
    },
    {
      id: idMock("acu", 2),
      trabajador_id: idMock("trb", 2),
      porcentaje_base: 4000,
      fecha_inicio: iso(hace(120)),
      fecha_fin: iso(hace(30)),
      created_at: iso(hace(120)),
    },
    {
      id: idMock("acu", 3),
      trabajador_id: idMock("trb", 2),
      porcentaje_base: 4500,
      fecha_inicio: iso(hace(30)),
      fecha_fin: null,
      created_at: iso(hace(30)),
    },
  ]);

  const rangos = z.array(esquemaRangoCilindraje).parse(
    (
      [
        ["Hasta 200cc", 0, 200],
        ["201-500cc", 201, 500],
        ["501cc en adelante", 501, null],
      ] as const
    ).map(([nombre, cc_min, cc_max], i) => ({
      id: idMock("rng", i + 1),
      negocio_id: negocioId,
      nombre,
      cc_min,
      cc_max,
      orden_visualizacion: i + 1,
      activo: true,
      created_at: baseCreacion,
      updated_at: baseCreacion,
    })),
  );

  const catalogo = [
    ["PAQUETE", "Servicio General - Básico", [2_000_000, 2_500_000, 3_000_000]],
    ["PAQUETE", "Servicio Detallado - Full", [3_500_000, 4_000_000, 5_000_000]],
    ["ADICIONAL", "Brillado de farola", [500_000, 600_000, 800_000]],
  ] as const;
  const servicios = z.array(esquemaServicio).parse(
    catalogo.map(([tipo, nombre], i) => ({
      id: idMock("srv", i + 1),
      negocio_id: negocioId,
      tipo,
      nombre,
      descripcion: null,
      activo: true,
      created_at: baseCreacion,
      updated_at: baseCreacion,
    })),
  );
  const precios = z.array(esquemaPrecio).parse(
    catalogo.flatMap(([, , valores], s) =>
      valores.map((precio, r) => ({
        id: idMock("prc", s * 3 + r + 1),
        servicio_id: idMock("srv", s + 1),
        rango_cilindraje_id: idMock("rng", r + 1),
        precio_centavos: precio,
        created_at: baseCreacion,
        updated_at: baseCreacion,
      })),
    ),
  );

  // Vehículos: placa de moto colombiana (ABC12D), cilindraje coherente con el rango.
  const LETRAS = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const placasUsadas = new Set<string>();
  const nuevaPlaca = (): string => {
    for (;;) {
      const letra = (): string => LETRAS.charAt(aleatorio.entero(0, LETRAS.length - 1));
      const placa = `${letra()}${letra()}${letra()}${String(aleatorio.entero(10, 99))}${letra()}`;
      if (!placasUsadas.has(placa)) {
        placasUsadas.add(placa);
        return placa;
      }
    }
  };
  const CILINDRAJES: readonly (readonly [number, number])[] = [
    [100, 200],
    [201, 500],
    [501, 900],
  ];
  const vehiculos = z.array(esquemaVehiculo).parse(
    Array.from({ length: 18 }, (_, i) => {
      const [min, max] = CILINDRAJES[i % 3] ?? [100, 200];
      return {
        id: idMock("veh", i + 1),
        negocio_id: negocioId,
        tipo: "MOTO",
        placa: nuevaPlaca(),
        cilindraje: aleatorio.entero(min, max),
        primer_ingreso: iso(hace(aleatorio.entero(2, 300))),
        updated_at: iso(hace(aleatorio.entero(0, 1))),
      };
    }),
  );

  // Órdenes del día operativo de `ahora`, repartidas entre el inicio del día local y `ahora`.
  const inicioDiaMs = Date.parse(`${diaDe(ahoraMs)}T00:00:00-05:00`); // Bogotá no tiene horario de verano
  const ordenes: Orden[] = [];
  const items: ItemOrden[] = [];
  const pagos: Pago[] = [];
  const eventos: EventoOrden[] = [];
  const total = ESPECIFICACION.length;
  let nItem = 0;
  let nPago = 0;
  let nEvento = 0;
  let cobradasVistas = 0;

  const acuerdoVigenteEn = (trabajadorId: string, instanteMs: number): AcuerdoComision => {
    const acuerdo = acuerdos.find(
      (a) =>
        a.trabajador_id === trabajadorId &&
        Date.parse(a.fecha_inicio) <= instanteMs &&
        (a.fecha_fin === null || instanteMs < Date.parse(a.fecha_fin)),
    );
    if (!acuerdo) throw new Error("Seed inconsistente: trabajador sin acuerdo vigente.");
    return acuerdo;
  };

  ESPECIFICACION.forEach((espec, i) => {
    const id = idMock("ord", i + 1);
    const creadaMs = inicioDiaMs + Math.floor(((ahoraMs - inicioDiaMs) * (i + 0.5)) / total);
    const resto = ahoraMs - creadaMs;
    const etapa = (k: number): number => creadaMs + Math.floor((resto * k) / 7);

    const vehiculo = vehiculos[i % vehiculos.length];
    const trabajador = aleatorio.elegir(trabajadores);
    const cc = vehiculo?.cilindraje;
    if (!vehiculo || cc === null || cc === undefined) {
      throw new Error("Seed inconsistente: vehículo.");
    }
    const rango = rangos.find((r) => cc >= r.cc_min && (r.cc_max === null || cc <= r.cc_max));
    if (!rango) throw new Error("Seed inconsistente: sin rango para el cilindraje.");

    // Ítems: copian nombre y precio de la matriz (congelamiento).
    const idsServicio = [servicios[i % 2], ...(i % 4 === 0 ? [servicios[2]] : [])];
    let totalOrden = 0;
    for (const servicio of idsServicio) {
      const precio = precios.find(
        (p) => p.servicio_id === servicio?.id && p.rango_cilindraje_id === rango.id,
      );
      if (!servicio || !precio) throw new Error("Seed inconsistente: precio faltante.");
      totalOrden += precio.precio_centavos;
      items.push(
        esquemaItemOrden.parse({
          id: idMock("itm", ++nItem),
          orden_id: id,
          servicio_id: servicio.id,
          servicio_nombre_congelado: servicio.nombre,
          precio_centavos_congelado: precio.precio_centavos,
          created_at: iso(creadaMs),
        }),
      );
    }

    const { estado } = espec;
    const llegoALista =
      ["LISTA", "COBRADA", "ENTREGADA"].includes(estado) || espec.cobrada === true;
    const seCobro =
      ((estado === "COBRADA" || estado === "ENTREGADA") && espec.cortesia !== true) ||
      espec.cobrada === true;
    const lavo = estado !== "CREADA";
    const fechaCobro = seCobro ? etapa(4) : null;
    const fechaAnulacion = estado === "ANULADA" ? etapa(espec.cobrada ? 5 : 3) : null;

    ordenes.push(
      esquemaOrden.parse({
        id,
        negocio_id: negocioId,
        vehiculo_id: vehiculo.id,
        trabajador_id: trabajador.id,
        operador_id: operador.id,
        rango_cilindraje_id: rango.id,
        porcentaje_comision_congelado: acuerdoVigenteEn(trabajador.id, creadaMs).porcentaje_base,
        rango_cilindraje_nombre_congelado: rango.nombre,
        estado,
        es_cortesia: espec.cortesia === true,
        motivo_cortesia: espec.cortesia ? "Cortesía por fidelidad del cliente" : null,
        motivo_anulacion:
          estado === "ANULADA"
            ? espec.cobrada
              ? "Se cobró el servicio equivocado; se reemplaza por otra orden"
              : "El cliente se retiró antes de empezar"
            : null,
        orden_reemplaza_id: espec.reemplazaALaPrimera ? idMock("ord", 1) : null,
        dia_operativo: diaDe(creadaMs),
        created_at: iso(creadaMs),
        fecha_asignacion: iso(etapa(1)),
        fecha_lavando: lavo ? iso(etapa(2)) : null,
        fecha_lista: llegoALista ? iso(etapa(3)) : null,
        fecha_cobro: fechaCobro === null ? null : iso(fechaCobro),
        fecha_entrega: estado === "ENTREGADA" ? iso(etapa(5)) : null,
        fecha_anulacion: fechaAnulacion === null ? null : iso(fechaAnulacion),
      }),
    );

    // Pagos.
    if (fechaCobro !== null) {
      const pagar = (monto: number, metodo: "EFECTIVO" | "QR", concepto: string | null): void => {
        pagos.push(
          esquemaPago.parse({
            id: idMock("pag", ++nPago),
            orden_id: id,
            monto_centavos: centavos(monto),
            metodo,
            concepto,
            dia_operativo: diaDe(fechaCobro),
            created_at: iso(fechaCobro),
          }),
        );
      };
      const nCobro = estado === "COBRADA" ? cobradasVistas++ : -1;
      if (nCobro === 0) {
        pagar(totalOrden + 500_000, "EFECTIVO", "propina"); // excedente ⇒ concepto obligatorio
      } else if (nCobro === 1) {
        const parteEfectivo = Math.floor(totalOrden / 2);
        pagar(parteEfectivo, "EFECTIVO", null); // D-10: pago partido efectivo + QR
        pagar(totalOrden - parteEfectivo, "QR", null);
      } else {
        pagar(totalOrden, i % 2 === 0 ? "EFECTIVO" : "QR", null);
      }
    }

    // Un evento por cada transición.
    const evento = (tipo: TipoEventoOrden, ms: number, datos: Record<string, unknown> | null) =>
      eventos.push(
        esquemaEventoOrden.parse({
          id: idMock("evt", ++nEvento),
          orden_id: id,
          tipo,
          usuario_id: operador.id,
          datos_json: datos,
          created_at: iso(ms),
        }),
      );
    evento("CREADA", creadaMs, null);
    evento("ASIGNADA", etapa(1), { trabajador_id: trabajador.id });
    if (lavo && estado !== "ANULADA") evento("LAVANDO", etapa(2), null);
    if (estado === "ANULADA") {
      evento("LAVANDO", etapa(2), null);
      if (espec.cobrada) {
        evento("LISTA", etapa(3), null);
        evento("COBRADA", etapa(4), null);
      }
      evento("ANULADA", etapa(espec.cobrada ? 5 : 3), { motivo: "anulación" });
    } else {
      if (llegoALista) evento("LISTA", etapa(3), null);
      if (seCobro) evento("COBRADA", etapa(4), null);
      if (estado === "ENTREGADA") evento("ENTREGADA", etapa(5), null);
    }
  });

  return {
    negocio,
    usuarios,
    trabajadores,
    acuerdos,
    rangos,
    servicios,
    precios,
    vehiculos,
    ordenes,
    items,
    pagos,
    eventos,
  };
}
