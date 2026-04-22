import { T } from '@/tokens';
import { useCartStore } from '@/stores/cart';
import type { OrderType } from '@/stores/cart';

// --- POS Terminal ---------------------------------------------------------
// The main cashier screen. Two-column layout: product grid (left) and
// cart/checkout (right, fixed 310px).
//
// Sessions:
//  - chunk 1 (this one): shell + header (search, order type, table)
//  - chunk 2: product grid + category filter + live search
//  - chunk 3: cart panel with line controls + discount
//  - chunk 4: checkout (card / cash / split) + receipt modal
//  - chunk 5: offline queue + hold/recall
// -------------------------------------------------------------------------

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
};

export function PosPage() {
  const type = useCartStore((s) => s.type);
  const setType = useCartStore((s) => s.setType);
  const tableNumber = useCartStore((s) => s.tableNumber);
  const setTable = useCartStore((s) => s.setTable);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left column — menu browsing */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: `1px solid ${T.border}`,
        }}
      >
        <PosHeader
          type={type}
          onTypeChange={setType}
          tableNumber={tableNumber}
          onTableChange={setTable}
        />

        {/* Category filter — chunk 2 */}
        <div
          style={{
            padding: '10px 16px',
            background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            color: T.textDim,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          Categories come next chunk
        </div>

        {/* Product grid — chunk 2 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.textDim,
            fontSize: 13,
          }}
        >
          Product grid lands in chunk 2.
        </div>
      </div>

      {/* Right column — cart / checkout (fixed 310px) */}
      <aside
        style={{
          width: 310,
          display: 'flex',
          flexDirection: 'column',
          background: T.surface,
          flexShrink: 0,
          padding: 20,
          gap: 8,
          color: T.textDim,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Cart</div>
        <div style={{ fontSize: 12 }}>Cart UI arrives in chunk 3.</div>
      </aside>
    </div>
  );
}

// -------------------------------------------------------------------------
// Header — search input (left), order-type toggle (middle),
// table number input (right, only when dine-in is selected).
// -------------------------------------------------------------------------
function PosHeader({
  type,
  onTypeChange,
  tableNumber,
  onTableChange,
}: {
  type: OrderType;
  onTypeChange: (t: OrderType) => void;
  tableNumber: string;
  onTableChange: (s: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '10px 16px',
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: T.textDim,
            fontSize: 15,
          }}
        >
          ⌕
        </span>
        <input
          disabled
          placeholder="Search menu…"
          style={{
            width: '100%',
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '8px 10px 8px 30px',
            color: T.text,
            fontSize: 13,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((t) => {
          const active = t === type;
          return (
            <button
              key={t}
              onClick={() => onTypeChange(t)}
              style={{
                padding: '7px 12px',
                borderRadius: 9,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                border: active ? `1px solid ${T.accent}50` : `1px solid ${T.border}`,
                background: active ? T.accentGlow : 'transparent',
                color: active ? T.accent : T.textMid,
                fontFamily: 'inherit',
              }}
            >
              {ORDER_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
      {type === 'DINE_IN' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: T.textDim, fontSize: 12, fontWeight: 600 }}>Table</span>
          <input
            value={tableNumber}
            onChange={(e) => onTableChange(e.target.value)}
            style={{
              width: 44,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '7px 6px',
              color: T.text,
              fontSize: 13,
              outline: 'none',
              textAlign: 'center',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}
    </div>
  );
}
