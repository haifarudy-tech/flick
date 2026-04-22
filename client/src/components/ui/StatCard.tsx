import type { ReactNode } from 'react';
import { T } from '@/tokens';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, sub, color, icon }: StatCardProps) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: T.textDim,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          {label}
        </span>
        {icon && <span style={{ fontSize: 16, opacity: 0.5 }}>{icon}</span>}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: color ?? T.text,
          letterSpacing: '-0.5px',
          marginBottom: 3,
        }}
        className="num"
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.textMid }}>{sub}</div>}
    </div>
  );
}
