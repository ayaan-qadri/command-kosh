import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zinc: {
          ...colors.slate,
          700: '#2A364F',
          800: '#1e2a3a',
          900: '#131b2a',
          950: '#0C1425',
        },
        teal: {
          ...colors.cyan,
          300: '#75FDFA',
          400: '#3FF5ED',
          500: '#1ABC9C',
        },
        emerald: {
          ...colors.cyan,
          300: '#75FDFA',
          400: '#3FF5ED',
          500: '#1ABC9C',
        }
      }
    },
  },
  plugins: [],
}
