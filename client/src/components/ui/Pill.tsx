import type { ReactNode } from 'react';

export function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      style={{
        background: color + '20',
        border: `1px solid ${color}40`,
        color,
        borderRadius: 20,
        padding: '2px 9px',
        fontSize: 11,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {children}
    </span>
  );
}
