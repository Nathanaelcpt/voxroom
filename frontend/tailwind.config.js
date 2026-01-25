/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // ⬅️ WAJIB supaya next-themes bekerja
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate")],
}
