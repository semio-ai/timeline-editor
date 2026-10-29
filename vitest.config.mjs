import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: {
      // Transform the published UI bundle so its CommonJS imports work in Node tests.
      deps: { inline: ["@semio/ui"] },
    },
  },
});
