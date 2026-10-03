import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Filament is 4850. Not 8080. Not 9191.
// Standing rule: nothing binds the wildcard. This machine only, 127.0.0.1.
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4850,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
