import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/vue";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// jsdom no trae matchMedia ni ResizeObserver y PrimeVue los usa.
if (typeof window.matchMedia !== "function") {
  const matchMediaFalso = (consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  Object.defineProperty(window, "matchMedia", { writable: true, value: matchMediaFalso });
  vi.stubGlobal("matchMedia", matchMediaFalso);
}

if (!("ResizeObserver" in window)) {
  class ResizeObserverFalso {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverFalso);
}
