// Scan HTML and React source for utility classes to include in generated CSS.
// The dark variant follows the same data-theme attribute used by the theme provider.

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [],
};
