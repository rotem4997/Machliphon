/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
      },
      colors: {
        navy: '#1e3a5f',
        mint: '#3eb489',
        sky: '#87ceeb',
      },
    },
  },
  plugins: [],
};
