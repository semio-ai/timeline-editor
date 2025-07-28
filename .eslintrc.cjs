/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["@semio/eslint-config/react.js"],
  ignorePatterns: ["docs/**/*"],
  rules: {
    // We will enable this again when development slows.
    "no-console": "off",
  },
};
