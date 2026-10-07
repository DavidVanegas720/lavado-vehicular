import { cleanup, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import BotonPeligro from "./BotonPeligro.vue";
import BotonPrincipal from "./BotonPrincipal.vue";
import BotonSecundario from "./BotonSecundario.vue";

afterEach(cleanup);

const botones = [
  ["BotonPrincipal", BotonPrincipal],
  ["BotonSecundario", BotonSecundario],
  ["BotonPeligro", BotonPeligro],
] as const;

describe.each(botones)("%s", (_nombre, Boton) => {
  it("renderiza etiqueta, tipo button por defecto y ≥ 44 px", () => {
    render(Boton, { props: { etiqueta: "Guardar" } });
    const b = screen.getByRole("button", { name: "Guardar" });
    expect(b).toHaveAttribute("type", "button");
    expect(b.className).toContain("min-h-11");
    expect(b.className).toContain("focus-visible:ring-2");
  });

  it("acepta tipo submit y bloque", () => {
    render(Boton, { props: { etiqueta: "Enviar", tipo: "submit", bloque: true } });
    const b = screen.getByRole("button", { name: "Enviar" });
    expect(b).toHaveAttribute("type", "submit");
    expect(b.className).toContain("w-full");
  });

  it("emite click", async () => {
    const resultado = render(Boton, { props: { etiqueta: "Ok" } });
    await userEvent.click(screen.getByRole("button", { name: "Ok" }));
    expect(resultado.emitted().click).toHaveLength(1);
  });

  it("no emite click si está deshabilitado", async () => {
    const resultado = render(Boton, { props: { etiqueta: "Ok", deshabilitado: true } });
    const b = screen.getByRole("button", { name: "Ok" });
    expect(b).toBeDisabled();
    await userEvent.click(b);
    expect(resultado.emitted().click).toBeUndefined();
  });

  it("cargando: aria-busy, spinner, sin click y conserva la etiqueta", async () => {
    const resultado = render(Boton, { props: { etiqueta: "Ok", cargando: true } });
    const b = screen.getByRole("button", { name: "Ok" });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).toHaveAttribute("aria-disabled", "true");
    expect(resultado.container.querySelector(".pi-spinner")).not.toBeNull();
    await userEvent.click(b);
    expect(resultado.emitted().click).toBeUndefined();
  });

  it("con ícono lo oculta a lectores de pantalla", () => {
    const { container } = render(Boton, { props: { etiqueta: "Nuevo", icono: "pi-plus" } });
    const i = container.querySelector("i.pi-plus");
    expect(i).toHaveAttribute("aria-hidden", "true");
  });

  it("solo ícono: nombre accesible desde ariaLabel y sin texto visible", () => {
    render(Boton, {
      props: { etiqueta: "Cerrar", icono: "pi-times", soloIcono: true, ariaLabel: "Cerrar panel" },
    });
    const b = screen.getByRole("button", { name: "Cerrar panel" });
    expect(b.textContent.trim()).toBe("");
    expect(b.className).toContain("min-w-11");
  });
});
