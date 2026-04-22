import { useState } from 'react';
import { T } from '@/tokens';
import { fmt } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { useCartStore, computeTotals } from '@/stores/cart';

// Cart view — everything shown in the 310px right rail when `view === 'cart'`.
// The parent decides when to swap to the checkout view.

export function CartPanel({ onCharge, onHold }: { onCharge: () => void; onHold: () => void }) {
  const lines = useCartStore((s) => s.lines);
  const type = useCartStore((s) => s.type);
  const tableNumber = useCartStore((s) => s.tableNumber);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const clear = useCartStore((s) => s.clear);
  const discountPercent = useCartStore((s) => s.discountPercent);

  const totals = computeTotals(lines, discountPercent, 0);

  const titleLabel =
    type === 'DINE_IN' ? `Table ${tableNumber}` : type === 'TAKEAWAY' ? 'Takeaway' : 'Delivery';

  return (
    <>
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{titleLabel}</div>
          <div style={{ fontSize: 11, color: T.textDim }}>
            {lines.length} item{lines.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {lines.length > 0 && (
            <Button variant="ghost" small onClick={onHold}>
              Hold
            </Button>
          )}
          {lines.length > 0 && (
            <Button variant="danger" small onClick={clear}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {lines.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 8,
              color: T.textDim,
            }}
          >
            <div style={{ fontSize: 36, opacity: 0.2 }}>◫</div>
            <div style={{ fontSize: 13 }}>Cart is empty</div>
            <div style={{ fontSize: 11 }}>Tap items to add</div>
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.menuItemId}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 16px',
                gap: 10,
                borderBottom: `1px solid ${T.border}25`,
              }}
            >
              <span style={{ fontSize: 16 }}>{line.emoji ?? '🍽'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {line.name}
                </div>
                <div className="num" style={{ fontSize: 11, color: T.textMid }}>
                  {fmt(line.unitPrice)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setQuantity(line.menuItemId, -1)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                    background: 'transparent',
                    color: T.textMid,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  −
                </button>
                <span
                  className="num"
                  style={{ fontSize: 13, fontWeight: 800, minWidth: 14, textAlign: 'center' }}
                >
                  {line.quantity}
                </span>
                <button
                  onClick={() => setQuantity(line.menuItemId, +1)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `1px solid ${T.accent}50`,
                    background: T.accentGlow,
                    color: T.accent,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  +
                </button>
              </div>
              <div
                className="num"
                style={{ fontSize: 12, fontWeight: 800, minWidth: 44, textAlign: 'right' }}
              >
                {fmt(line.unitPrice * line.quantity)}
              </div>
            </div>
          ))
        )}
      </div>

      {lines.length > 0 && <DiscountRow />}

      {lines.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
          <TotalsBlock
            subtotal={totals.subtotal}
            discount={totals.discount}
            discountPercent={discountPercent}
            vat={totals.vat}
            total={totals.total}
          />
        </div>
      )}

      <div style={{ padding: '0 16px 16px' }}>
        <Button full disabled={lines.length === 0} onClick={onCharge}>
          {lines.length > 0 ? `Charge ${fmt(totals.total)}` : 'Add items to charge'}
        </Button>
      </div>
    </>
  );
}

function DiscountRow() {
  const discountPercent = useCartStore((s) => s.discountPercent);
  const setDiscountPercent = useCartStore((s) => s.setDiscountPercent);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(discountPercent || ''));

  const apply = () => {
    const n = Math.max(0, Math.min(100, parseFloat(draft) || 0));
    setDiscountPercent(n);
    setEditing(false);
  };
  const remove = () => {
    setDiscountPercent(0);
    setDraft('');
  };

  return (
    <div style={{ padding: '8px 16px', borderTop: `1px solid ${T.border}` }}>
      {editing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="% off"
            type="number"
            min={0}
            max={100}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            style={{
              flex: 1,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '7px 10px',
              color: T.text,
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <Button small onClick={apply}>
            Apply
          </Button>
        </div>
      ) : discountPercent > 0 ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              background: 'transparent',
              border: `1px solid ${T.green}35`,
              color: T.green,
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            ✓ {discountPercent}% discount applied
          </button>
          <Button variant="danger" small onClick={remove}>
            ×
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'transparent',
            border: `1px dashed ${T.border}`,
            color: T.textMid,
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            width: '100%',
            fontFamily: 'inherit',
          }}
        >
          + Add discount
        </button>
      )}
    </div>
  );
}

export function TotalsBlock({
  subtotal,
  discount,
  discountPercent,
  vat,
  total,
}: {
  subtotal: number;
  discount: number;
  discountPercent: number;
  vat: number;
  total: number;
}) {
  const rows: Array<[string, string, { color?: string }?]> = [
    ['Subtotal', fmt(subtotal)],
    ...(discount > 0
      ? ([[`Disc. ${discountPercent}%`, `−${fmt(discount)}`, { color: T.green }]] as const)
      : []),
    ['VAT (incl.)', fmt(vat)],
  ];
  return (
    <>
      {rows.map(([label, value, opts]) => (
        <div
          key={label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: T.textMid,
            marginBottom: 4,
          }}
        >
          <span>{label}</span>
          <span className="num" style={opts?.color ? { color: opts.color } : {}}>
            {value}
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 19,
          fontWeight: 900,
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px solid ${T.border}`,
          letterSpacing: '-0.4px',
        }}
      >
        <span>Total</span>
        <span className="num" style={{ color: T.accent }}>
          {fmt(total)}
        </span>
      </div>
    </>
  );
}
