/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#3c2f2f',
        red: '#854442',
        coffee: '#6f4436',
        mocha: '#be9b7b',
        beige: '#faf0dc',
        milk: '#fffdf6',
      },
      fontFamily: {
        'serif': ['Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}