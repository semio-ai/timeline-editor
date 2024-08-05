/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  // prefix: "",
  presets: [require("@semio/tailwind-config")],
  darkMode: "selector",
  theme: {
    extend: {
      data: {
        expanded: "expanded~=true",
      },
    },
  },
};
