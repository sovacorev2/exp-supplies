/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef3f3',
          100: '#fde7e7',
          200: '#fbcfcf',
          300: '#f7aaaa',
          400: '#f07878',
          500: '#ED1C24', // Exp primary red
          600: '#d41820',
          700: '#b01319',
          800: '#920e15',
          900: '#7a0b11',
        },
        silver: {
          50:  '#f9f9fa',
          100: '#f3f3f4',
          200: '#e7e7e8',
          300: '#d0d0d2',
          400: '#b9b9bb',
          500: '#6D6E71', // Exp silver
          600: '#626366',
          700: '#575859',
          800: '#4c4d4f',
          900: '#414245',
        },
      },
      fontFamily: {
        sans: [
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
