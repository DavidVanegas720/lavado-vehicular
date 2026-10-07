/** Mueve el foco al `<h1>` de la vista para anunciar el cambio a lectores de pantalla. */
export function enfocarEncabezado(): void {
  document.querySelector<HTMLElement>("#contenido h1")?.focus({ preventScroll: true });
}
