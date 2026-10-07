/** Reloj de los mocks. Las E2E fijan la hora con `page.clock`. */
export function ahora(): Date {
  return new Date();
}
