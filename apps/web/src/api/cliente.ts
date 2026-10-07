import { entorno } from "../config/entorno";
import { buscarManejador } from "../mocks/registro";
import { modoDe } from "./modo";
import type { Peticion, Resultado } from "./tipos";

interface ConfigCliente {
  latencia: readonly [number, number];
  tasaError: number;
  /** Fuerza el modo de todos los módulos (solo pruebas). */
  modo: ModoApi | undefined;
}

const porDefecto = (): ConfigCliente => ({
  latencia: [entorno.mockLatenciaMinMs, entorno.mockLatenciaMaxMs],
  tasaError: entorno.mockErrorRate,
  modo: undefined,
});

let config: ConfigCliente = porDefecto();
let contadorErrores = 0;

/** PRNG determinista (mulberry32) para que latencia y errores simulados sean reproducibles. */
function crearPrng(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let aleatorio = crearPrng(20260101);

/** Para pruebas: ajusta latencia/tasa de error/modo y reinicia el PRNG. Sin args, restaura el entorno. */
export function configurarClienteParaPruebas(
  parcial: { latencia?: readonly [number, number]; tasaError?: number; modo?: ModoApi } = {},
): void {
  config = { ...porDefecto(), ...parcial };
  contadorErrores = 0;
  aleatorio = crearPrng(20260101);
}

const esperar = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolver) => setTimeout(resolver, ms));

async function pedirMock<T>(p: Peticion<T>): Promise<Resultado<T>> {
  const [min, max] = config.latencia;
  await esperar(min + aleatorio() * (max - min));

  if (config.tasaError > 0 && aleatorio() < config.tasaError) {
    contadorErrores += 1;
    return contadorErrores % 2 === 1
      ? { estado: "sin-respuesta" }
      : { estado: "servidor", mensaje: "Error simulado del servidor" };
  }

  const manejador = buscarManejador(p.metodo, p.ruta);
  if (manejador === undefined) {
    return {
      estado: "servidor",
      mensaje: `No hay manejador mock para ${p.metodo} ${p.ruta}`,
    };
  }

  const crudo = await manejador({ consulta: p.consulta, cuerpo: p.cuerpo });
  if (crudo.estado !== "ok") return structuredClone(crudo);

  const validado = p.esquemaRespuesta.safeParse(crudo.datos);
  if (!validado.success) {
    console.error(`Respuesta mock inválida en ${p.metodo} ${p.ruta}`, validado.error.issues);
    return {
      estado: "servidor",
      mensaje: `La respuesta de ${p.metodo} ${p.ruta} no cumple el esquema esperado`,
    };
  }
  // Copia para que la vista no pueda mutar el estado interno del mock.
  return { estado: "ok", datos: structuredClone(validado.data) };
}

/** Único punto de salida de datos del frontend. Nunca lanza: todo error viene tipado. */
export async function pedir<T>(p: Peticion<T>): Promise<Resultado<T>> {
  const modo = config.modo ?? modoDe(p.modulo);
  if (modo === "mock") return pedirMock(p);
  // Único archivo con permiso de `fetch` (aún sin uso): se implementa en Fase 2.
  return { estado: "servidor", mensaje: "Modo http disponible en Fase 2" };
}
