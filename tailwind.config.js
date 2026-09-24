/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        flight: {
          light: "#D97706",
          dark: "#FFE066",
        },
        hsr: {
          light: "#059669",
          dark: "#10B981",
        },
      },
    },
  },
  plugins: [],
};
