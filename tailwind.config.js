/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pine: { DEFAULT: '#0F3B24', 2: '#154A2E', 3: '#1D5C2F', soft: '#E6EFE8' }, // deep greens from the Sammha logo
        ink: '#0D1B2A',
        stone: { DEFAULT: '#F4F5F7', deep: '#E9ECF0' },
        paper: '#FFFFFF',
        line: '#DFE3E8',
        muted: '#5B6675',
        gold: { DEFAULT: '#AE832C', soft: '#F3EBDA', deep: '#80601E', light: '#D9BD82' },
        qaadan: { DEFAULT: '#1E5A8C', soft: '#E3EDF6', deep: '#143F63' },
        bakkar: { DEFAULT: '#A23B4F', soft: '#F6E4E7', deep: '#742838' },
        istithmar: { DEFAULT: '#5E3D8F', soft: '#EFE9F7', deep: '#42286A' },
        ok: '#0E7C6B',
        warn: '#946410',
        bad: '#B0362B',
      },
      fontFamily: {
        kufi: ['Tajawal', 'system-ui', 'sans-serif'],
        sans: ['Tajawal', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,59,36,.06), 0 4px 16px -8px rgba(15,59,36,.12)',
        lift: '0 12px 32px -12px rgba(15,59,36,.28)',
      },
    },
  },
  plugins: [],
}
