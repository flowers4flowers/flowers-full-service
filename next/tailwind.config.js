/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      'primary': ['ABC Monument Grotesk', 'Helvetica', 'sans-serif'],
      'secondary': ['ABC Monument Grotesk', 'sans-serif'],
    },
    fontSize: {
      'sm': ['1rem'],
      'md': ['1.2rem'],
      'base': ['1.5rem'],
      'lg': ['2rem'],
      'xl': ['3rem'],
      'xxl': ['5rem'],
    },
    colors: {
      black: '#000000',
      white: '#ffffff',
      transparent: 'transparent',
      cream: '#EEEBE6',
      'light-cream': '#D9D9D9'
    },
    extend: {
      width: {
        container: 'clamp(0px, 90%, 1300px)',
      },
    },
  },
  plugins: [],
}
