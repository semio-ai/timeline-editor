import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/tests/setup/deep-freeze-snapshots.ts"],
    server: {
      // Transform the published UI bundle so its CommonJS imports work in Node tests.
      deps: { inline: ["@semio/ui"] },
    },
  },
});
