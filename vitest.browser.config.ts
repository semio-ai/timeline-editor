import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Enable browser mode with Playwright
    browser: {
      enabled: true,
      provider: "playwright",
      // Configure browser instances
      instances: [
        {
          browser: "chromium",
        },
      ],
      // Enable headless: false for debugging with visible browser
      headless: false,
    },

    // Setup files for browser tests
    setupFiles: ["./src/tests/browser/setup.ts"],

    // Include only browser tests when using this config
    include: ["src/tests/browser/**/*.{test,spec}.{js,jsx,ts,tsx}"],

    // Exclude node-based tests
    exclude: ["node_modules", "dist", "src/tests/!(browser)/**/*"],

    // Global test timeout (longer for browser tests)
    testTimeout: 30000,

    // Hook timeout
    hookTimeout: 30000,

    // Coverage settings (optional, disable for debugging)
    coverage: {
      enabled: false,
    },

    // Reporter for browser tests
    reporters: ["verbose"],

    // Global variables available in tests
    globals: true,

    // CSS handling
    css: {
      modules: {
        classNameStrategy: "non-scoped",
      },
    },
  },

  // Resolve aliases
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@semio/animation": path.resolve(__dirname, "./src"),
      "@semio/utils": path.resolve(__dirname, "../utils/src"),
      "@semio/ui": path.resolve(__dirname, "../ui/src"),
    },
  },

  // Build options for test files
  esbuild: {
    target: "es2020",
    jsx: "automatic",
  },

  // Define global constants
  define: {
    "process.env.NODE_ENV": '"test"',
  },

  // Server configuration for serving test files
  server: {
    fs: {
      // Allow serving files from project root and dependencies
      allow: [".."],
    },
  },
});
