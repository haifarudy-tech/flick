// Flick design tokens — canonical values.
//
// These match the spec exactly. Once the reference JSX files
// (flick-pos-complete.jsx, flick-pos-v2.jsx) are in the repo, we'll lock in any
// additional component-level tokens (spacing scales, shadow ramps) from those
// files without changing the values below.

export const T = {
  bg: '#0C0B09',
  surface: '#161410',
  card: '#1E1B16',
  cardHover: '#252119',
  border: '#2A2620',
  borderLight: '#332E27',
  accent: '#E07A4A',
  accentDark: '#B85E32',
  accentGlow: 'rgba(224,122,74,0.12)',
  gold: '#C8993A',
  green: '#4EA86B',
  red: '#C95454',
  blue: '#4A8BC8',
  purple: '#9B72CF',
  text: '#EDE8DF',
  textMid: '#9A8E7E',
  textDim: '#524840',
} as const;

export const RADIUS = {
  sm: '8px',
  md: '12px',
  card: '16px',
  pill: '20px',
} as const;

export const FONT = {
  body:
    '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono:
    '"DM Mono", "SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace',
} as const;

export type DesignToken = keyof typeof T;
