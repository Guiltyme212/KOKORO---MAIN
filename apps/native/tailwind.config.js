/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./node_modules/heroui-native/lib/**/*.{js,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Kokoro 3.0 palette — source of truth, mirrors apps/web/src/styles/kokoro3.css
        ink: "#1b1b1b",
        muted: "#76715e",
        cream: "#f6ebd7",
        paper: "#fffaf0",
        stroke: "rgba(27,27,27,0.14)",
        moss: {
          DEFAULT: "#64764e",
          dark: "#4e6749",
          olive: "#82863a",
        },
        mustard: "#ecc34a",
        sunset: "#fc6708",
      },
      fontFamily: {
        rounded: ["MPLUSRounded1c", "Nunito", "system-ui", "sans-serif"],
        body: ["Nunito", "system-ui", "sans-serif"],
      },
      boxShadow: {
        k3: "0 24px 60px rgba(27, 27, 27, 0.18)",
      },
    },
  },
  plugins: [],
};
