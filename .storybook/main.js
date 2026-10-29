import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import tailwindcss from "@tailwindcss/postcss";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, "package.json")));
}

const config = {
  stories: ["../stories/*.stories.tsx", "../stories/**/*.stories.tsx"],

  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-designs"),
  ],

  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },

  core: {},

  async viteFinal(config) {
    return {
      ...config,
      css: { postcss: { plugins: [tailwindcss()] } },
      resolve: {
        ...config.resolve,
        // Only this package uses source; dependencies use their published exports.
        alias: [
          ...(Array.isArray(config.resolve?.alias) ? config.resolve.alias : []),
          {
            find: /^@semio\/animation$/,
            replacement: resolve(__dirname, "../src/index.tsx"),
          },
        ],
      },
    };
  },

  docs: {},

  typescript: {
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      tsconfigPath: resolve(__dirname, "../tsconfig.json"),
      include: [resolve(__dirname, "../src/**/*.tsx")],
      // Barrels and registry maps expose glyph keys, not component declarations.
      exclude: ["**/src/index.tsx", "**/src/icons/registry/**"],
    },
  },
};

export default config;
