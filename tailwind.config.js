/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#006880",
        "primary-light": "#72d9fd",
        "surface-container": "#f0f4f5",
        "surface-variant": "#dce4e6",
        "on-surface": "#2b3438",
        "on-surface-variant": "#576065",
        "outline-variant": "#c0c8ca",
        error: "#a83836",
        "error-container": "#fa746f",
      },
    },
  },
  plugins: [],
};
