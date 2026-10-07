import { centavosDesdePesos, type Centavos } from "@lavado-vehicular/shared/dominio/dinero";

// Formateadores creados una vez (costoso construirlos). Regla 1: sin parseFloat ni división en dinero.
const conSimbolo = (decimales: 0 | 2): Intl.NumberFormat =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
const sinSimbolo = (decimales: 0 | 2): Intl.NumberFormat =>
  new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

const MONEDA_ENTERA = conSimbolo(0);
const MONEDA_CON_CENTAVOS = conSimbolo(2);
const NUMERO_ENTERO = sinSimbolo(0);
const NUMERO_CON_CENTAVOS = sinSimbolo(2);

/** Texto decimal exacto ("1234.56") a partir de centavos, sin dividir. */
function aDecimalTexto(c: Centavos): `${number}` {
  const texto = String(c).padStart(3, "0");
  return `${texto.slice(0, -2)}.${texto.slice(-2)}` as `${number}`;
}

export function formatear(c: Centavos): string {
  const formateador = c % 100 === 0 ? MONEDA_ENTERA : MONEDA_CON_CENTAVOS;
  return formateador.format(aDecimalTexto(c));
}

export function formatearSinSimbolo(c: Centavos): string {
  const formateador = c % 100 === 0 ? NUMERO_ENTERO : NUMERO_CON_CENTAVOS;
  return formateador.format(aDecimalTexto(c));
}

/** Toma solo los dígitos (pesos enteros). `null` si no hay dígitos o excede el rango seguro. */
export function parsearPesos(texto: string): Centavos | null {
  const digitos = texto.replace(/\D/g, "");
  if (digitos === "") return null;
  const pesos = Number(digitos);
  if (!Number.isSafeInteger(pesos * 100)) return null;
  return centavosDesdePesos(pesos);
}

export function useFormatoMoneda(): {
  formatear: typeof formatear;
  formatearSinSimbolo: typeof formatearSinSimbolo;
  parsearPesos: typeof parsearPesos;
} {
  return { formatear, formatearSinSimbolo, parsearPesos };
}
