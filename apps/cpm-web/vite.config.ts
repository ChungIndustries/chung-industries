import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    // TanStack Router plugin MUST come before React
    tanstackRouter(),
    tailwindcss(),
    react(),
    // Runs the API worker (src/worker) and the SPA together under `vite dev`,
    // with the service binding to a concurrently running `nx dev cpm-registry`
    // resolved through wrangler's local dev registry.
    cloudflare(),
  ],
});
