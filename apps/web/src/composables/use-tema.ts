import { readonly, ref } from "vue";

export type Tema = "claro" | "oscuro";

const CLAVE_ALMACENAMIENTO = "lv.tema";
const CLASE_OSCURO = "app-oscuro";

const esTema = (valor: unknown): valor is Tema => valor === "claro" || valor === "oscuro";

function leerGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    return esTema(valor) ? valor : null;
  } catch {
    return null; // almacenamiento bloqueado o no disponible: se sigue sin persistir
  }
}

function preferenciaSistema(): Tema {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
  } catch {
    return "claro";
  }
}

// Estado a nivel de módulo (no Pinia: no es estado de dominio).
const temaActual = ref<Tema>("claro");

function aplicarClase(tema: Tema): void {
  document.documentElement.classList.toggle(CLASE_OSCURO, tema === "oscuro");
}

/** Determina el tema inicial (storage, si no sistema) y lo aplica. Llamar antes de `mount`. */
export function aplicarTemaInicial(): void {
  temaActual.value = leerGuardado() ?? preferenciaSistema();
  aplicarClase(temaActual.value);
}

function establecer(tema: Tema): void {
  temaActual.value = tema;
  aplicarClase(tema);
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, tema);
  } catch {
    // sin persistencia: el tema sigue funcionando durante la sesión
  }
}

function alternar(): void {
  establecer(temaActual.value === "oscuro" ? "claro" : "oscuro");
}

export function useTema() {
  return { tema: readonly(temaActual), alternar, establecer };
}
