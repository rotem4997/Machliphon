/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm dark — replaces cold navy; used for text, sidebar, headings
        navy: {
          900: '#2C1A0E',   // deep warm espresso
          800: '#3D2810',
          700: '#52391A',
          600: '#6E5030',
          300: '#C4A882',
        },
        // Warm coral-orange — replaces teal mint; primary CTA, active states
        mint: {
          500: '#FF6B35',
          400: '#FF8659',
          300: '#FFA07A',
          100: '#FFF0EB',
        },
        // Golden amber — replaces sky blue; secondary accent
        sky: {
          500: '#F59E0B',
        },
        // Warm cream — page backgrounds, subtle fills
        warm: {
          50:  '#FFF8F0',
          100: '#FFE8D0',
        },
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
        display: ['Heebo', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
