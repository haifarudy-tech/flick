import type { InputHTMLAttributes, ReactNode } from 'react';
import { T } from '@/tokens';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  invalid?: boolean;
}

export function Input({ leading, invalid, style, ...rest }: InputProps) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {leading && (
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: T.textMid,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {leading}
        </span>
      )}
      <input
        {...rest}
        style={{
          width: '100%',
          background: T.card,
          border: `1px solid ${invalid ? T.red : T.border}`,
          borderRadius: 10,
          padding: leading ? '11px 12px 11px 30px' : '11px 12px',
          color: T.text,
          fontSize: 13,
          outline: 'none',
          fontFamily: 'inherit',
          ...style,
        }}
      />
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: T.textDim,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
