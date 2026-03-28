/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#eff5ea',
        surface: '#fbfdf8',
        surface_container_lowest: '#ffffff',
        surface_container_low: '#f3f8ed',
        surface_container: '#eaf3e2',
        surface_container_high: '#dfead4',
        surface_container_highest: '#cfddc1',
        surface_bright: '#fcfef9',
        primary: '#1f8f49',
        primary_container: '#72cb54',
        primary_fixed: '#dff7c8',
        on_primary: '#ffffff',
        on_primary_fixed: '#102315',
        secondary: '#c98a19',
        secondary_container: '#fff0c9',
        tertiary: '#188d78',
        tertiary_container: '#d8f0ea',
        tertiary_fixed_dim: '#136c5d',
        error: '#c73d32',
        error_container: '#ffe1de',
        outline: '#52674f',
        outline_variant: '#a9bc9f',
        on_surface: '#142016',
        on_surface_variant: '#344436',
        on_surface_error: '#6a1711',
        inverse_surface: '#1c2a1e',
        inverse_on_surface: '#f4f8ef',
      },
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #1f8f49 0%, #5dbe4f 52%, #d8b842 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
