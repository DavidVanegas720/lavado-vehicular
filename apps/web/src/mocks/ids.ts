const LARGO_CUID = 25;

/** Id estable tipo cuid: `"c" + prefijo + n` rellenado con ceros hasta 25 caracteres. */
export function idMock(prefijo: string, n: number): string {
  const cuerpo = String(n);
  const relleno = Math.max(0, LARGO_CUID - 1 - prefijo.length - cuerpo.length);
  return `c${prefijo}${"0".repeat(relleno)}${cuerpo}`;
}
