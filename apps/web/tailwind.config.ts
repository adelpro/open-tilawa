import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import animated from 'tailwindcss-animated';

const config: Config = {
  mode: 'jit',
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        divider: 'var(--divider)',
        ink: 'var(--ink)',
        'ink-secondary': 'var(--ink-secondary)',
        'ink-tertiary': 'var(--ink-tertiary)',
        accent: 'var(--accent)',
        error: 'var(--error)',
        success: 'var(--success)',
        /* Legacy aliases kept so untouched pages (about/privacy/contact) resolve. */
        background: 'var(--canvas)',
        foreground: 'var(--ink)',
        'canvas-parchment': 'var(--surface-1)',
        'surface-pearl': 'var(--surface-1)',
        primary: 'var(--accent)',
        hairline: 'var(--divider)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Amiri', '"IBM Plex Sans Arabic"', 'serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      transitionTimingFunction: {
        quiet: 'cubic-bezier(0.2, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(2%)', opacity: '0.4' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        sheetUp: 'sheetUp 240ms cubic-bezier(0.2, 0, 0.2, 1)',
      },
    },
  },
  plugins: [forms, animated, typography],
};

export default config;
