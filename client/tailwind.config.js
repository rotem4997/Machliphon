/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0D2137', 800: '#162844', 700: '#1E3A52', 600: '#2A4F6E' },
        mint: { 500: '#17C98A', 400: '#35D99A', 300: '#5EE4B0', 100: '#E8FDF5' },
        sky: { 500: '#3B82F6' },
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
        display: ['Heebo', 'sans-serif'],
      },
      direction: { rtl: 'rtl' },
    },
  },
  plugins: [],
}
