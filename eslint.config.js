import js from "@eslint/js";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import prettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfigWithVueTs(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/blob-report/**",
      "**/.vite/**",
    ],
  },
  js.configs.recommended,
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      // Se desactiva por línea con un comentario que explique por qué (convención).
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Prohibido `enum`: usar `as const` + tipo derivado.",
        },
      ],
      "vue/no-v-html": "error",
      "vue/block-lang": ["error", { script: { lang: "ts" } }],
      "vue/component-api-style": ["error", ["script-setup"]],
    },
  },
  // Archivos JS de configuración: sin reglas que exigen información de tipos.
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // fetch solo en el cliente HTTP.
  {
    files: ["apps/web/src/**/*.{ts,vue}"],
    ignores: ["apps/web/src/api/cliente.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Las llamadas HTTP pasan por src/api/cliente.ts." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "fetch",
          message: "Las llamadas HTTP pasan por src/api/cliente.ts.",
        },
        {
          object: "globalThis",
          property: "fetch",
          message: "Las llamadas HTTP pasan por src/api/cliente.ts.",
        },
      ],
    },
  },
  // Los mocks solo se importan desde src/api/ y src/mocks/.
  {
    files: ["apps/web/src/**/*.{ts,vue}"],
    ignores: ["apps/web/src/api/**", "apps/web/src/mocks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/mocks/*", "**/mocks/*"],
              message: "Los mocks solo se importan desde src/api/ y src/mocks/.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
