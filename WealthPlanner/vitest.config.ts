import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
    setupFiles: ["packages/client/src/test/setup.ts"],
  },
});
