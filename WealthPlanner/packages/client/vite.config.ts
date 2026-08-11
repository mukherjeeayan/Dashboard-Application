import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/plans": "http://127.0.0.1:4321",
      "/jurisdiction-packs": "http://127.0.0.1:4321",
      "/documentation": "http://127.0.0.1:4321",
      "/health": "http://127.0.0.1:4321",
    },
  },
});
