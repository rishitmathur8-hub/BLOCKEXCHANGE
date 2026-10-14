/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        railway: {
          950: '#070D18',
          900: '#0B1528',
          850: '#0F1D38',
          800: '#15274A',
          750: '#1C3360',
          700: '#234177',
          600: '#325CA2',
          500: '#437CD4',
          400: '#6999E4',
          300: '#9CBDF1',
          200: '#CCE0FA',
          100: '#E8F1FD',
          50:  '#F4F8FE',
        },
        dept: {
          eng: '#F59E0B',       // Engineering - Amber
          st: '#10B981',        // S&T - Emerald
          ohe: '#8B5CF6',       // OHE - Violet
          general: '#3B82F6',   // General - Blue
        },
        status: {
          requested: '#64748B',
          proposed: '#EAB308',
          approved: '#10B981',
          started: '#0284C7',
          completed: '#475569',
          overrun: '#EF4444',
          cancelled: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['"Barlow"', 'system-ui', '-apple-system', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
