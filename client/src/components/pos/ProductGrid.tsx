import { useState } from 'react';
import { T } from '@/tokens';
import { fmt, marginPct } from '@/lib/format';
import type { MenuItem } from '@/types/menu';
import { useCartStore } from '@/stores/cart';

export function ProductGrid({ items }: { items: MenuItem[] }) {
  const addItem = useCartStore((s) => s.addItem);
  const lines = useCartStore((s) => s.lines);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const tap = (item: MenuItem) => {
    setJustAdded(item.id);
    window.setTimeout(() => setJustAdded(null), 350);
    addItem(item);
  };

  if (items.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: T.textDim,
          gap: 8,
        }}
      >
        <div style={{ fontSize: 30, opacity: 0.25 }}>⌕</div>
        <div style={{ fontSize: 13 }}>No items match</div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10,
        alignContent: 'start',
      }}
    >
      {items.map((item) => {
        const inCart = lines.find((l) => l.menuItemId === item.id);
        const just = justAdded === item.id;
        const margin = marginPct(item.basePrice, item.costPrice);
        return (
          <button
            key={item.id}
            onClick={() => tap(item)}
            style={{
              background: just ? T.accentGlow : T.card,
              border: inCart ? `1px solid ${T.accent}55` : `1px solid ${T.border}`,
              borderRadius: 14,
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'left',
              color: T.text,
              transition: 'all 0.15s',
              position: 'relative',
              transform: just ? 'scale(0.96)' : 'scale(1)',
              fontFamily: 'inherit',
            }}
          >
            {item.isPopular && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: T.accent,
                }}
              />
            )}
            {inCart && (
              <div
                className="num"
                style={{
                  position: 'absolute',
                  top: -7,
                  right: -7,
                  background: T.accent,
                  color: '#fff',
                  borderRadius: '50%',
                  width: 21,
                  height: 21,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 2px 8px ${T.accent}50`,
                }}
              >
                {inCart.quantity}
              </div>
            )}
            <div style={{ fontSize: 24, marginBottom: 8 }}>{item.emoji ?? '🍽'}</div>
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
              {item.name}
            </div>
            <div className="num" style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>
              {fmt(item.basePrice)}
            </div>
            {margin > 0 && (
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{margin}% margin</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
