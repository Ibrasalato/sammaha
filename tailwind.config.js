/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#221E1A',
        stone: { DEFAULT: '#EEECE6', deep: '#E3E0D7' },
        paper: '#FAF9F6',
        line: '#D6D1C4',
        muted: '#6B645A',
        gold: { DEFAULT: '#AE832C', soft: '#E9DCBE', deep: '#7D5E1F' },
        qaadan: { DEFAULT: '#2C4A78', soft: '#DCE4F0', deep: '#1D3357' },
        bakkar: { DEFAULT: '#9C3F4C', soft: '#F2DEE0', deep: '#6E2A34' },
        ok: '#2F6B4F',
        warn: '#9A6A12',
        bad: '#A23B2E',
      },
      fontFamily: {
        kufi: ['"Reem Kufi"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
