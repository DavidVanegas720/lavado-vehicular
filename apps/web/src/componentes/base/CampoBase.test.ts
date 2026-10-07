import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import CampoBase from "./CampoBase.vue";

const slot = `<template #default="c"><input :id="c.id" :aria-describedby="c.describedby" /></template>`;
const montar = (props: Record<string, unknown>) =>
  render(CampoBase, { props: { etiqueta: "Nombre", ...props }, slots: { default: slot } });

afterEach(cleanup);

describe("CampoBase", () => {
  it("asocia la etiqueta con el control", () => {
    montar({});
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("usa el id recibido", () => {
    montar({ id: "mi-campo" });
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("id", "mi-campo");
  });

  it("describe el control con ayuda y error", () => {
    montar({ id: "c", ayuda: "Como en la cédula", error: "Es obligatorio" });
    const control = screen.getByLabelText("Nombre");
    expect(control).toHaveAccessibleDescription("Como en la cédula Es obligatorio");
  });

  it("el error vive en una región aria-live polite", () => {
    montar({ id: "c", error: "Es obligatorio" });
    expect(screen.getByText("Es obligatorio").closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("marca el requerido con asterisco decorativo", () => {
    montar({ requerido: true });
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("en modo grupo la etiqueta no es un label", () => {
    montar({ grupo: true, id: "g" });
    expect(screen.getByText("Nombre").tagName).toBe("SPAN");
    expect(screen.getByText("Nombre")).toHaveAttribute("id", "g-etiqueta");
  });
});
