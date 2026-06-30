/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0A0A0F',
          900: '#12121A',
          800: '#1C1C28',
          700: '#26263A',
          600: '#3A3A52',
        },
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
        emerald: {
          400: '#34D399',
          500: '#10B981',
        },
        rose: {
          400: '#FB7185',
          500: '#F43F5E',
        },
        sky: {
          400: '#38BDF8',
        }
      }
    },
  },
  plugins: [],
}
