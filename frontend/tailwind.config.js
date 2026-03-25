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
        surface_container_lowest: '#0e0d0d',
        surface_container_low: '#1c1b1b',
        surface_container: '#201f1f',
        surface_container_high: '#2a2a2a',
        surface_container_highest: '#353534',
        surface_bright: '#3a3939',
        primary: '#b3c5ff',
        primary_container: '#1765f2',
        primary_fixed: '#d9e2ff',
        on_primary: '#002b75',
        on_primary_fixed: '#001849',
        secondary: '#f3be58',
        secondary_container: '#3d2f00',
        tertiary: '#7ce0a9',
        tertiary_container: '#003920',
        tertiary_fixed_dim: '#62c490',
        error: '#ff8a85',
        error_container: '#5c0004',
        outline: '#8c90a2',
        outline_variant: '#424656',
        on_surface: '#e5e2e1',
        on_surface_variant: '#c2c6d9',
        on_surface_error: '#ffdad8',
        inverse_surface: '#e5e2e1',
        inverse_on_surface: '#322f2e',
      },
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #1765f2 0%, #b3c5ff 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
