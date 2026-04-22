import type { Config } from 'tailwindcss';
import { T, RADIUS, FONT } from './src/tokens';

// Tailwind consumes the same token object so the design system has a single
// source of truth. Any palette change happens in src/tokens.ts.

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: T.bg,
        surface: T.surface,
        card: T.card,
        'card-hover': T.cardHover,
        border: T.border,
        'border-light': T.borderLight,
        accent: T.accent,
        'accent-dark': T.accentDark,
        'accent-glow': T.accentGlow,
        gold: T.gold,
        green: T.green,
        red: T.red,
        blue: T.blue,
        purple: T.purple,
        text: T.text,
        'text-mid': T.textMid,
        'text-dim': T.textDim,
      },
      borderRadius: {
        sm: RADIUS.sm,
        md: RADIUS.md,
        card: RADIUS.card,
        pill: RADIUS.pill,
      },
      fontFamily: {
        sans: FONT.body.split(',').map((s) => s.replace(/^\s*"?|"?\s*$/g, '')),
        mono: FONT.mono.split(',').map((s) => s.replace(/^\s*"?|"?\s*$/g, '')),
      },
      boxShadow: {
        warm: '0 2px 12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.02)',
        'warm-lg': '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)',
        accent: `0 0 0 1px ${T.border}, 0 0 24px ${T.accentGlow}`,
      },
    },
  },
  plugins: [],
};

export default config;
