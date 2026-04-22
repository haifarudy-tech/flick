import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { useCartStore, computeTotals } from '@/stores/cart';
import type { OrderType } from '@/stores/cart';
import { useAuthStore } from '@/stores/auth';
import { useMenu } from '@/hooks/useMenu';
import { useCreateOrder } from '@/hooks/useCreateOrder';
import { CategoryBar } from '@/components/pos/CategoryBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutPanel, type CheckoutResult } from '@/components/pos/CheckoutPanel';
import { ReceiptModal, type ReceiptInfo } from '@/components/pos/ReceiptModal';
import { HoldsPanel } from '@/components/pos/HoldsPanel';
import { useOfflineFlusher } from '@/hooks/useCreateOrder';
import { api } from '@/lib/api';

// --- POS Terminal ---------------------------------------------------------
// Chunks:
//  - chunk 1: shell + header (done)
//  - chunk 2: product grid + category filter + live search (done)
//  - chunk 3: cart panel with line controls + discount (done)
//  - chunk 4 (this): checkout (card / cash / split) + receipt modal
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
  const lines = useCartStore((s) => s.lines);
  const discountPercent = useCartStore((s) => s.discountPercent);
  const customerName = useCartStore((s) => s.customerName);
  const customerPhone = useCartStore((s) => s.customerPhone);
  const deliveryAddress = useCartStore((s) => s.deliveryAddress);
  const clearCart = useCartStore((s) => s.clear);

  const business = useAuthStore((s) => s.business);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [view, setView] = useState<'cart' | 'checkout'>('cart');
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);
  const [showHolds, setShowHolds] = useState(false);

  const heldCount = useCartStore((s) => s.held.length);
  const hold = useCartStore((s) => s.hold);

  const menu = useMenu();
  const createOrder = useCreateOrder();
  const { pending: offlinePending } = useOfflineFlusher();

  const filteredItems = useMemo(() => {
    if (!menu.data) return [];
    const q = search.trim().toLowerCase();
    return menu.data.items.filter((i) => {
      if (!i.isAvailable) return false;
      if (categoryId !== 'all' && i.categoryId !== categoryId) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [menu.data, search, categoryId]);

  const totals = computeTotals(lines, discountPercent, 0);

  const submitOrder = async (result: CheckoutResult) => {
    if (lines.length === 0) return;

    const res = await createOrder.mutateAsync({
      type,
      tableNumber: type === 'DINE_IN' ? tableNumber : undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      deliveryAddress: type === 'DELIVERY' ? deliveryAddress || undefined : undefined,
      discountAmount: 0,
      discountPercent,
      items: lines.map((l) => ({
        menuItemId: l.menuItemId,
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        notes: l.notes,
        modifiers: l.modifiers,
      })),
    });

    // Fire-and-forget cash payment record on the server when known.
    // Card payments are finalised via Stripe Terminal in session 5.
    if (!res.queued && result.method === 'CASH' && result.cashTendered != null) {
      try {
        await api.post('/api/v1/payments/cash', {
          orderId: res.id,
          amount: totals.total,
          tendered: result.cashTendered,
        });
      } catch {
        /* non-fatal — the order itself is on record */
      }
    }

    setReceipt({
      orderNumber: res.queued ? 'offline' : res.id.slice(-4).toUpperCase(),
      businessName: business?.name ?? 'Flick',
      total: totals.total,
      subtotal: totals.subtotal,
      vat: totals.vat,
      discount: totals.discount,
      lines,
      paymentMethod: result.method,
      change: result.change,
    });

    clearCart();
    setView('cart');
  };

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
          search={search}
          onSearch={setSearch}
          type={type}
          onTypeChange={setType}
          tableNumber={tableNumber}
          onTableChange={setTable}
          heldCount={heldCount}
          onOpenHolds={() => setShowHolds(true)}
          offlinePending={offlinePending}
        />

        {menu.isLoading ? (
          <CategorySkeleton />
        ) : (
          <CategoryBar
            categories={menu.data?.categories ?? []}
            active={categoryId}
            onChange={setCategoryId}
          />
        )}

        {menu.isLoading ? (
          <GridSkeleton />
        ) : menu.isError ? (
          <ErrorState
            message={
              menu.error instanceof Error ? menu.error.message : 'Menu failed to load'
            }
          />
        ) : filteredItems.length === 0 && (menu.data?.items.length ?? 0) === 0 ? (
          <EmptyMenuState />
        ) : (
          <ProductGrid items={filteredItems} />
        )}
      </div>

      {/* Right column — cart / checkout (fixed 310px) */}
      <aside
        style={{
          width: 310,
          display: 'flex',
          flexDirection: 'column',
          background: T.surface,
          flexShrink: 0,
        }}
      >
        {view === 'cart' ? (
          <CartPanel onCharge={() => setView('checkout')} onHold={hold} />
        ) : (
          <CheckoutPanel
            onBack={() => setView('cart')}
            onConfirm={submitOrder}
            submitting={createOrder.isPending}
          />
        )}
      </aside>

      {receipt && <ReceiptModal info={receipt} onClose={() => setReceipt(null)} />}
      {showHolds && <HoldsPanel onClose={() => setShowHolds(false)} />}
    </div>
  );
}

// -------------------------------------------------------------------------
// Header — search input, order-type toggle, table number input.
// -------------------------------------------------------------------------
function PosHeader({
  search,
  onSearch,
  type,
  onTypeChange,
  tableNumber,
  onTableChange,
  heldCount,
  onOpenHolds,
  offlinePending,
}: {
  search: string;
  onSearch: (s: string) => void;
  type: OrderType;
  onTypeChange: (t: OrderType) => void;
  tableNumber: string;
  onTableChange: (s: string) => void;
  heldCount: number;
  onOpenHolds: () => void;
  offlinePending: number;
}) {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
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
          value={search}
          onChange={(e) => onSearch(e.target.value)}
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

      {/* Right-edge toolbar: held orders button + offline indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        {(!online || offlinePending > 0) && (
          <div
            title={
              !online
                ? `Offline · ${offlinePending} order${offlinePending !== 1 ? 's' : ''} queued`
                : `${offlinePending} order${offlinePending !== 1 ? 's' : ''} syncing…`
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 20,
              border: `1px solid ${!online ? T.red : T.gold}35`,
              background: !online ? 'rgba(201,84,84,0.12)' : 'rgba(200,153,58,0.12)',
              color: !online ? T.red : T.gold,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: !online ? T.red : T.gold,
              }}
            />
            {!online ? 'Offline' : `${offlinePending} queued`}
          </div>
        )}
        <button
          onClick={onOpenHolds}
          style={{
            position: 'relative',
            padding: '7px 12px',
            borderRadius: 9,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${T.border}`,
            background: 'transparent',
            color: T.textMid,
            fontFamily: 'inherit',
          }}
        >
          Held
          {heldCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                background: T.accent,
                color: '#fff',
                borderRadius: '50%',
                width: 18,
                height: 18,
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 2px 8px ${T.accent}50`,
              }}
            >
              {heldCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Small loading + error states kept inline to avoid file sprawl.
// -------------------------------------------------------------------------
function CategorySkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '10px 16px',
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 60,
            height: 26,
            borderRadius: 20,
            background: T.card,
            border: `1px solid ${T.border}`,
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div
      style={{
        flex: 1,
        padding: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10,
        alignContent: 'start',
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            height: 104,
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}

function EmptyMenuState() {
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
        padding: 30,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 36, opacity: 0.25 }}>🍽</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>No menu items yet</div>
      <div style={{ fontSize: 12, maxWidth: 300 }}>
        Add your first items in the menu manager to start taking orders. Menu CRUD ships in
        session 3 — for now, seed items via the API or Supabase.
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.red,
        gap: 8,
      }}
    >
      <div style={{ fontSize: 30 }}>⚠</div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{message}</div>
    </div>
  );
}
