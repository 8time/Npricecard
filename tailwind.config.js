/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f1df',
        ink: '#2f241d',
        accent: '#d13b24',
        gold: '#ebb73f',
        bark: '#7b522d',
      },
      boxShadow: {
        card: '0 8px 24px rgba(72, 38, 16, 0.14)',
      },
      fontFamily: {
        display: ['"Hiragino Maru Gothic ProN"', '"Yu Gothic"', 'sans-serif'],
        body: ['"BIZ UDPGothic"', '"Yu Gothic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
