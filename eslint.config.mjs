import { storybookConfig } from "@semio/eslint-config/storybook";

export default [
  ...storybookConfig(),
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
