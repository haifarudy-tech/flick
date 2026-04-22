import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { T } from '@/tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  small?: boolean;
  full?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

// Matches the Btn component in the reference exactly — same colours, radii,
// weights, shadows, and the 135° accent gradient on primary.
export function Button({
  variant = 'primary',
  small,
  full,
  icon,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const variants: Record<Variant, { bg: string; color: string; border: string; shadow: string }> = {
    primary: {
      bg: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
      color: '#fff',
      border: 'none',
      shadow: `0 4px 18px ${T.accent}35`,
    },
    secondary: {
      bg: T.card,
      color: T.textMid,
      border: `1px solid ${T.border}`,
      shadow: 'none',
    },
    danger: {
      bg: 'rgba(201,84,84,0.12)',
      color: T.red,
      border: `1px solid ${T.red}30`,
      shadow: 'none',
    },
    ghost: {
      bg: 'transparent',
      color: T.textMid,
      border: `1px dashed ${T.border}`,
      shadow: 'none',
    },
    success: {
      bg: 'rgba(78,168,107,0.12)',
      color: T.green,
      border: `1px solid ${T.green}30`,
      shadow: 'none',
    },
  };
  const s = variants[variant];
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        background: disabled ? T.card : s.bg,
        color: disabled ? T.textDim : s.color,
        border: s.border,
        borderRadius: small ? 8 : 12,
        padding: small ? '6px 14px' : full ? '14px' : '10px 18px',
        width: full ? '100%' : 'auto',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: small ? 12 : 13,
        fontWeight: 700,
        boxShadow: disabled ? 'none' : s.shadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'all 0.15s',
        letterSpacing: '-0.1px',
        ...style,
      }}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
