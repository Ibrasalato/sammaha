/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sammha brand identity: forest green #00513B, deep green #092F27, primary gold #C99532, warm ivory #F7F3E8
        pine: { DEFAULT: '#00513B', 2: '#004532', 3: '#006247', soft: '#E3EFEA', deep: '#092F27' },
        ivory: '#F7F3E8',
        ink: '#0D1B2A',
        stone: { DEFAULT: '#F4F5F7', deep: '#E9ECF0' },
        paper: '#FFFFFF',
        line: '#DFE3E8',
        muted: '#5B6675',
        // filled gold takes deep-green text: white on #C99532 is below readable contrast
        gold: { DEFAULT: '#C99532', soft: '#F5ECD8', deep: '#80601E', light: '#DDB965' },
        // name categories: قعدان بنفسجي، بكار أخضر، منقية ذهبي
        qaadan: { DEFAULT: '#6B4C8F', soft: '#F1ECF7', deep: '#4A2F6B' },
        bakkar: { DEFAULT: '#1F6B3A', soft: '#E6F2EA', deep: '#134626' },
        manqiya: { DEFAULT: '#A57A26', soft: '#F6EEDB', deep: '#6E5216' },
        // general accents (not categories)
        info: { DEFAULT: '#1E5A8C', soft: '#E3EDF6', deep: '#143F63' },
        rose: { DEFAULT: '#A23B4F', soft: '#F6E4E7', deep: '#742838' },
        invest: { DEFAULT: '#1E5A8C', soft: '#E3EDF6', deep: '#143F63' }, // «استثمار الاسم» service accent
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
