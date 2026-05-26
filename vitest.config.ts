import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests run against PGlite (in-process Postgres) — no Neon needed. The "@" alias
// mirrors tsconfig so the code under test resolves "@/db", "@/lib/*" normally.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
