/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dbfe',
          300: '#81c1fd',
          400: '#3da1fb',
          500: '#0f83e6',
          600: '#0a67c0',
          700: '#0b579e',
          800: '#0d487f',
          900: '#0f3c68',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 35px rgba(15, 131, 230, 0.08)',
      },
    },
  },
  plugins: [],
}
