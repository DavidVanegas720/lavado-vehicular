import { reactive, ref, useId, watch } from "vue";
import type { Ref } from "vue";
import type { ZodType } from "zod";

export type ErroresForm<T> = Partial<Record<keyof T & string, string>>;

export interface Formulario<T extends Record<string, unknown>, S> {
  /** Valores editables; se enlazan con `v-model`. */
  valores: T;
  /** Primer mensaje de error por campo (solo campos ya tocados o tras un envío). */
  errores: Ref<ErroresForm<T>>;
  /** Id estable de un campo (para `CampoBase`/entradas y para enfocar el primer inválido). */
  id: (campo: keyof T & string) => string;
  /** Marca el campo como tocado y valida solo ese campo (llamar en `blur`). */
  alSalir: (campo: keyof T & string) => void;
  /** Valida todo, muestra todos los errores y devuelve los datos tipados o `null`. */
  validar: () => S | null;
  /** Vuelve a los valores iniciales y limpia errores. */
  reiniciar: () => void;
}

/**
 * Estado y validación de un formulario con un esquema Zod (de shared).
 * Valida al salir de cada campo y al enviar; una vez mostrado, el error se corrige en vivo.
 */
export function useForm<T extends Record<string, unknown>, S = T>(
  esquema: ZodType<S, T>,
  iniciales: T,
): Formulario<T, S> {
  const prefijo = useId();
  const copiaInicial = { ...iniciales };
  const valores = reactive({ ...iniciales }) as T;
  const errores = ref<ErroresForm<T>>({}) as Ref<ErroresForm<T>>;

  function mensajesPorCampo(): { datos: S | null; mensajes: ErroresForm<T> } {
    const resultado = esquema.safeParse({ ...valores });
    if (resultado.success) return { datos: resultado.data, mensajes: {} };
    const mensajes: ErroresForm<T> = {};
    for (const problema of resultado.error.issues) {
      const campo = String(problema.path[0] ?? "") as keyof T & string;
      if (campo !== "" && mensajes[campo] === undefined) mensajes[campo] = problema.message;
    }
    return { datos: null, mensajes };
  }

  function actualizarCampo(campo: keyof T & string): void {
    const { mensajes } = mensajesPorCampo();
    const mensaje = mensajes[campo];
    const resto = Object.entries(errores.value).filter(([clave]) => clave !== campo);
    if (mensaje !== undefined) resto.push([campo, mensaje]);
    errores.value = Object.fromEntries(resto) as ErroresForm<T>;
  }

  // Un error ya visible se corrige (o se actualiza) mientras se escribe.
  watch(
    () => ({ ...valores }),
    () => {
      for (const campo of Object.keys(errores.value) as Array<keyof T & string>) {
        actualizarCampo(campo);
      }
    },
  );

  function validar(): S | null {
    const { datos, mensajes } = mensajesPorCampo();
    errores.value = mensajes;
    return datos;
  }

  function reiniciar(): void {
    Object.assign(valores, copiaInicial);
    errores.value = {};
  }

  return {
    valores,
    errores,
    id: (campo) => `${prefijo}-${campo}`,
    alSalir: actualizarCampo,
    validar,
    reiniciar,
  };
}
