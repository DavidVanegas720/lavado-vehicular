import { defineConfig, devices } from "@playwright/test";

const escritorio = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  projects: [
    {
      name: "movil",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 }, hasTouch: true },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    { name: "escritorio", use: escritorio },
    {
      name: "escritorio-movimiento-reducido",
      use: { ...escritorio, reducedMotion: "reduce" },
    },
    { name: "escritorio-oscuro", use: { ...escritorio, colorScheme: "dark" } },
  ],
  webServer: {
    command: "pnpm dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    env: { VITE_MOCK_ERROR_RATE: "0" },
  },
});
