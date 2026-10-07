import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { z } from "zod";
import { useForm } from "@/composables/use-form";
import EntradaTexto from "./EntradaTexto.vue";
import FormularioBase from "./FormularioBase.vue";

const esquema = z.object({
  nombre: z.string().min(1, "Escribe el nombre"),
  apodo: z.string().min(1, "Escribe el apodo"),
});

function montar(props: { enviando?: boolean; errorGeneral?: string | null } = {}) {
  const Envoltorio = defineComponent({
    setup() {
      const f = useForm(esquema, { nombre: "", apodo: "" });
      return () =>
        h(
          FormularioBase,
          {
            formulario: f,
            etiquetaEnviar: "Guardar",
            ...props,
            onEnviar: (v: unknown) => (enviados.push(v), undefined),
          },
          () => [
            h(EntradaTexto, {
              id: f.id("nombre"),
              etiqueta: "Nombre",
              modelValue: f.valores.nombre,
              error: f.errores.value.nombre,
              "onUpdate:modelValue": (v: string) => (f.valores.nombre = v),
              onBlur: () => {
                f.alSalir("nombre");
              },
            }),
            h(EntradaTexto, {
              id: f.id("apodo"),
              etiqueta: "Apodo",
              modelValue: f.valores.apodo,
              error: f.errores.value.apodo,
              "onUpdate:modelValue": (v: string) => (f.valores.apodo = v),
              onBlur: () => {
                f.alSalir("apodo");
              },
            }),
          ],
        );
    },
  });
  const enviados: unknown[] = [];
  return { enviados, ...render(Envoltorio) };
}

describe("FormularioBase", () => {
  it("no envía si es inválido, enfoca el primer campo inválido y resume errores", async () => {
    const usuario = userEvent.setup();
    const { enviados } = montar();
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));
    expect(enviados).toHaveLength(0);
    expect(screen.getByLabelText(/Nombre/)).toHaveFocus();
    expect(screen.getByText("Revisa 2 campos con errores.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Apodo/)).toHaveAttribute("aria-invalid", "true");
  });

  it("valida al salir de un campo", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByLabelText(/Nombre/));
    await usuario.tab();
    expect(screen.getByText("Escribe el nombre")).toBeInTheDocument();
    expect(screen.queryByText("Escribe el apodo")).not.toBeInTheDocument();
  });

  it("Enter envía los valores validados", async () => {
    const usuario = userEvent.setup();
    const { enviados } = montar();
    await usuario.type(screen.getByLabelText(/Nombre/), "Ana");
    await usuario.type(screen.getByLabelText(/Apodo/), "Nena{Enter}");
    expect(enviados).toEqual([{ nombre: "Ana", apodo: "Nena" }]);
  });

  it("muestra el error general", () => {
    montar({ errorGeneral: "No se pudo guardar" });
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");
  });

  it("enviando: botón cargando y no envía", async () => {
    const usuario = userEvent.setup();
    const { enviados } = montar({ enviando: true });
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton).toHaveAttribute("aria-busy", "true");
    await usuario.type(screen.getByLabelText(/Nombre/), "Ana");
    await usuario.type(screen.getByLabelText(/Apodo/), "Nena{Enter}");
    expect(enviados).toHaveLength(0);
  });
});
