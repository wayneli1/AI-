/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // ⚠️ 就是加了这一行！没有它，你的 Markdown 就不会有极美的排版！
    require('@tailwindcss/typography'),
  ],
}