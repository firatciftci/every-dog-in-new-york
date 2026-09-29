import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: [vitePreprocess()],
      adapter: adapter({ fallback: "404.html" }),
      vitePlugin: { inspector: { toggleKeyCombo: "control-o" } },
      experimental: { explicitEnvironmentVariables: true },
      typescript: {
        config: (config) => {
          (config.include as Array<string>).push(
            "../eslint.config.js",
            "../knip.config.ts",
          );
          Object.assign(config.compilerOptions, {
            noImplicitOverride: true,
            noUncheckedIndexedAccess: true,
          });
        },
      },
    }),
    {
      /**
       * MapLibre's worker only import()s its RTL-text plugin, which we never load.
       * Vite rewrites the dynamic import and pulls in /@vite/client, which throws in a
       * worker because there is no document. Removing the dead call leaves nothing to rewrite.
       */
      name: "maplibre-worker-drop-rtl-plugin-loader",
      apply: "serve",
      transform(code, id) {
        if (!id.includes("maplibre-gl-worker.mjs")) {
          return null;
        }

        return {
          code: code.replaceAll(
            /(?<![.\w$])import\([A-Za-z_$][\w$]*\)/g,
            "Promise.reject(new Error('setRTLTextPlugin is disabled in dev'))",
          ),
          map: null,
        };
      },
    },
  ],
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: "./vite.config.ts",
        test: {
          name: "rules",
          environment: "node",
          include: ["src/**/*.{test,spec}.ts"],
          exclude: ["src/**/*.svelte.{test,spec}.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "browser",
          include: ["src/**/*.svelte.{test,spec}.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium", headless: true }],
          },
        },
      },
    ],
  },
});
