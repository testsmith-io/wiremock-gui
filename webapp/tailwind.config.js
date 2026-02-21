/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4f9',
          100: '#d5e3f0',
          200: '#abc7e0',
          300: '#80abd1',
          400: '#568fc1',
          500: '#205d96',
          600: '#1a4a78',
          700: '#14385a',
          800: '#0e263c',
          900: '#08141e',
        },
        accent: {
          50: '#f5fae6',
          100: '#e8f3c8',
          200: '#d4e99e',
          300: '#bfde74',
          400: '#9fc93c',
          500: '#8ab534',
          600: '#6e9129',
          700: '#536d1f',
          800: '#374914',
          900: '#1c240a',
        },
      },
    },
  },
  plugins: [],
}
