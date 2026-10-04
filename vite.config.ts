import { fileURLToPath } from "node:url";
import adapter from "@sveltejs/adapter-bun";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import UnoCSS from "@unocss/vite";
import { defineConfig } from "vite";

const DEFAULT_DEV_PORT = 3000;

export function resolveDevPort(rawPort: string | undefined): number {
  const trimmed = rawPort?.trim();
  if (!trimmed) {
    return DEFAULT_DEV_PORT;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_DEV_PORT;
  }

  return parsed;
}

const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  // SvelteKit 3 no longer generates $lib; tsconfig.json declares the same path.
  resolve: { alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) } },
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({ out: "build", precompress: true }),
      csp: {
        mode: "auto",
        directives: {
          "default-src": ["self"],
          "script-src": ["self"],
          // All inline `style="..."` attributes were refactored out of the codebase;
          // dynamic widths and CSS custom properties live in component <style> blocks
          // (which SvelteKit auto-nonces) or in data-attribute-driven CSS rules.
          "style-src": ["self"],
          "style-src-elem": ["self"],
          "img-src": ["self", "data:", "https://plex.tv", "https://*.plex.direct"],
          "connect-src": ["self", "https://plex.tv", "https://*.plex.direct"],
          "font-src": ["self"],
          "worker-src": isDev ? ["self", "blob:"] : ["self"],
          "object-src": ["none"],
          "base-uri": ["self"],
          "form-action": ["self"],
          "frame-ancestors": ["none"],
        },
      },
    }),
    UnoCSS(),
  ],
  server: { port: resolveDevPort(process.env.PORT), strictPort: true },
});
