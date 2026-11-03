/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ivory: {
          50: '#FCFBF9',
          100: '#FAF8F5',
          200: '#F7F4EF', // Base background
          300: '#EEE9E0',
          400: '#E4DDD0',
          500: '#D5CBB9',
        },
        charcoal: {
          50: '#F5F5F5',
          100: '#E5E4E2',
          300: '#8C8782',
          500: '#4D4844',
          700: '#33302D',
          800: '#252321', // Base text
          900: '#181716',
        },
        brand: {
          50: '#FDF2F7',
          100: '#FBE4EE',
          200: '#F6C9DD',
          300: '#EEA2C5',
          400: '#E06DA2',
          500: '#CC417E',
          600: '#B02564',
          700: '#94174F',
          800: '#7C0E44', // Signature Rablo brand color
          900: '#67103B',
          DEFAULT: '#7C0E44',
        },
        lavender: {
          50: '#FDF2F7',
          100: '#FBE4EE',
          200: '#F6C9DD',
          300: '#EEA2C5',
          400: '#E06DA2',
          500: '#CC417E',
          600: '#A3185B',
          700: '#7C0E44', // Signature #7C0E44 brand tone
          800: '#640A36',
          900: '#4A0727',
          DEFAULT: '#7C0E44',
        },
        sage: {
          50: '#F4F6F3',
          100: '#E5EAE3',
          200: '#CAD4C7',
          300: '#B0BFA9',
          400: '#929C8A', // Base supporting
          500: '#75806D',
          600: '#5A6353',
          700: '#444C3E',
        },
        peach: {
          50: '#FBF8F5',
          100: '#F6EFEA',
          200: '#EDDCD3',
          300: '#E5CBBC',
          400: '#DFC3B2', // Base supporting
          500: '#C19982',
          600: '#9E745C',
          700: '#7C5641',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Newsreader"', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        'soft-sm': '0 2px 8px -2px rgba(37, 35, 33, 0.05)',
        'soft': '0 4px 20px -2px rgba(37, 35, 33, 0.08)',
        'soft-lg': '0 12px 32px -4px rgba(37, 35, 33, 0.12)',
        'soft-xl': '0 20px 48px -8px rgba(37, 35, 33, 0.16)',
      },
      borderRadius: {
        'spiral': '18px',
      },
    },
  },
  plugins: [],
};
