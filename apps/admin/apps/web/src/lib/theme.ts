export const colors = {
  primary: '#0a63c2',
  secondary: '#f9c741',
  error: '#b00',
  warning: '#ffb200',
  neutral: '#333',
  background: '#f5f5f5',
  surface: '#fff',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const;

export const typography = {
  base: '16px',
  lg: '18px',
  xl: '20px',
} as const;

export function toCssVariables() {
  const vars: Record<string, string> = {};
  Object.entries(colors).forEach(([k, v]) => {
    vars[`--color-${k}`] = v;
  });
  Object.entries(spacing).forEach(([k, v]) => {
    vars[`--space-${k}`] = v;
  });
  Object.entries(typography).forEach(([k, v]) => {
    vars[`--type-${k}`] = v;
  });
  return vars;
}
