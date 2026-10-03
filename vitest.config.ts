import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

// Only component tests may resolve SvelteKit's browser exports; server code under test
// (e.g. `redirect`) must get the server implementations.
const componentTests = ["src/lib/components/**/*.test.ts", "src/routes/**/*.svelte.test.ts"];

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve("src/lib"),
      "$app/forms": path.resolve("src/lib/test-stubs/app-forms.ts"),
      "$app/navigation": path.resolve("src/lib/test-stubs/app-navigation.ts"),
      "$app/state": path.resolve("src/lib/test-stubs/app-state.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    projects: [
      {
        extends: true,
        plugins: [svelteTesting()],
        test: { name: "components", include: componentTests },
      },
      {
        extends: true,
        test: {
          name: "server",
          include: ["src/**/*.test.ts", "vite.config.test.ts"],
          exclude: [...componentTests, "e2e/**", "node_modules/**"],
        },
      },
    ],
  },
});
