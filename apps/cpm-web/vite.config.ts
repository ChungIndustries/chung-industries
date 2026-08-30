import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    watch: {
      // Miniflare continuously writes local state (observability traces, cache
      // sqlite) under .wrangler/ while `vite dev` runs; without this the file
      // watcher treats every write as a source change and full-reloads forever.
      ignored: ["**/.wrangler/**"],
    },
  },
  plugins: [
    tailwindcss(),
    // The documented order for TanStack Start on Workers: cloudflare (bound to
    // the ssr environment), then Start, then React.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
  ],
});
