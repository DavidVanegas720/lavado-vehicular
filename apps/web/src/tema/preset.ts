import Aura from "@primeuix/themes/aura";
import { definePreset } from "@primeuix/themes";

/** Preset de PrimeVue: Aura con el primario del proyecto (azul) y modo oscuro por clase. */
export const presetLavado = definePreset(Aura, {
  semantic: {
    primary: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554",
    },
  },
});

export const opcionesTema = {
  darkModeSelector: ".app-oscuro",
  cssLayer: { name: "primevue", order: "theme, base, primevue" },
} as const;
