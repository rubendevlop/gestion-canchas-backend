/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#131313',
        surface: '#131313',
        surface_container_low: '#1c1b1b',
        surface_container: '#201f1f',
        surface_container_high: '#2a2a2a',
        surface_container_highest: '#353534',
        surface_bright: '#3a3939',
        primary: '#b3c5ff',
        primary_container: '#1765f2',
        on_primary: '#002b75',
        secondary: '#f3be58',
        outline: '#8c90a2',
        outline_variant: '#424656',
        on_surface: '#e5e2e1',
        on_surface_variant: '#c2c6d9',
      },
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #1765f2 0%, #b3c5ff 100%)',
      }
    },
  },
  plugins: [],
}
