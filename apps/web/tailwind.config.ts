import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import animated from 'tailwindcss-animated';

const config: Config = {
  mode: 'jit',
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--canvas)',
        foreground: 'var(--ink)',
        canvas: 'var(--canvas)',
        'canvas-parchment': 'var(--canvas-parchment)',
        'surface-pearl': 'var(--surface-pearl)',
        'canvas-cream': 'var(--canvas-cream)',
        ink: 'var(--ink)',
        'ink-secondary': 'var(--ink-secondary)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        support: 'var(--support)',
        hairline: 'var(--hairline)',
        error: 'var(--error)',
        success: 'var(--success)',
        'tint-selected': 'var(--tint-selected)',
      },
    },
    keyframes: {
      slideIn: {
        '0%': { transform: 'translateY(-100%)' },
        '100%': { transform: 'translateY(0)' },
      },
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      appear: {
        from: {
          opacity: '0',
          transform: 'translateY(4rem)',
        },
        to: {
          opacity: '1',
          transform: 'translateY(0%)',
        },
      },
    },
    animation: {
      slideIn: 'slideIn 0.2s ease-out',
      fadeIn: 'fadeIn 0.4s ease-out',
      slideInWithFade: 'slideIn 0.2s ease-out, fadeIn 0.5s ease-out',
    },
  },
  plugins: [forms, animated, typography],
};

export default config;
