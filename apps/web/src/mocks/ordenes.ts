import { sumarCentavos } from "@lavado-vehicular/shared/dominio/dinero";
import {
  calcularDiaOperativo,
  esquemaDiaOperativo,
} from "@lavado-vehicular/shared/dominio/dia-operativo";
import type { ResumenOrdenTablero } from "@lavado-vehicular/shared/esquemas/ordenes";
import { obtenerEstado } from "./estado";
import { ahora } from "./reloj";
import { registrarManejador } from "./registro";

export function registrarMocksOrdenes(): void {
  // Solo lectura en F1-1. Sin `dia`: día operativo actual (función única de shared).
  registrarManejador("GET /api/ordenes/tablero", ({ consulta }) => {
    const estado = obtenerEstado();
    const pedido = consulta?.["dia"];
    let dia: string;
    if (pedido === undefined) {
      dia = calcularDiaOperativo(ahora(), estado.negocio).dia;
    } else {
      const validado = esquemaDiaOperativo.safeParse(pedido);
      if (!validado.success) {
        return { estado: "servidor", mensaje: "El día debe tener formato AAAA-MM-DD" };
      }
      dia = validado.data;
    }

    const datos: ResumenOrdenTablero[] = estado.ordenes
      .filter((o) => o.dia_operativo === dia)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((orden) => {
        const vehiculo = estado.vehiculos.find((v) => v.id === orden.vehiculo_id);
        if (vehiculo === undefined) {
          throw new Error(`Seed inconsistente: la orden ${orden.id} no tiene vehículo`);
        }
        const items = estado.items.filter((i) => i.orden_id === orden.id);
        return {
          ...orden,
          placa: vehiculo.placa,
          cilindraje: vehiculo.cilindraje,
          trabajador_nombre:
            estado.trabajadores.find((t) => t.id === orden.trabajador_id)?.nombre ?? null,
          items,
          total_centavos: sumarCentavos(items.map((i) => i.precio_centavos_congelado)),
        };
      });
    return { estado: "ok", datos };
  });
}
