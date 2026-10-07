import type { ConsultaApi, MetodoHttp, Resultado } from "../api/tipos";

export interface EntradaMock {
  readonly consulta: ConsultaApi | undefined;
  readonly cuerpo: unknown;
}

export type ManejadorMock = (p: EntradaMock) => Resultado<unknown> | Promise<Resultado<unknown>>;

const manejadores = new Map<string, ManejadorMock>();

/** Registra un manejador con clave `"GET /api/..."`. Registrar dos veces la misma clave es un error. */
export function registrarManejador(clave: string, manejador: ManejadorMock): void {
  if (manejadores.has(clave)) {
    throw new Error(`Ya existe un manejador mock para "${clave}"`);
  }
  manejadores.set(clave, manejador);
}

export function buscarManejador(metodo: MetodoHttp, ruta: string): ManejadorMock | undefined {
  return manejadores.get(`${metodo} ${ruta}`);
}

/** Solo para pruebas: deja el registro vacío. */
export function limpiarManejadoresParaPruebas(): void {
  manejadores.clear();
}
