/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        secondary: 'var(--bg-secondary)',
        surface: 'var(--surface-card)',
        elevated: 'var(--surface-elevated)',
        accent: 'var(--accent-primary)',
        cyanGlow: 'var(--accent-cyan)',
        violetGlow: 'var(--accent-violet)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        glow: 'var(--shadow-accent)',
      },
    },
  },
  plugins: [],
};
