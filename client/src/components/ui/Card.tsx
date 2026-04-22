import type { CSSProperties, ReactNode } from 'react';
import { T } from '@/tokens';

export function Card({
  children,
  style,
  padding = 16,
  borderRadius = 16,
  hoverable,
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: number | string;
  borderRadius?: number;
  hoverable?: boolean;
}) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius,
        padding,
        transition: hoverable ? 'background 0.15s' : undefined,
        ...style,
      }}
      onMouseEnter={
        hoverable
          ? (e) => ((e.currentTarget as HTMLDivElement).style.background = T.cardHover)
          : undefined
      }
      onMouseLeave={
        hoverable
          ? (e) => ((e.currentTarget as HTMLDivElement).style.background = T.card)
          : undefined
      }
    >
      {children}
    </div>
  );
}
