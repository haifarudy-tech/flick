import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { useCartStore } from '@/stores/cart';
import type { OrderType } from '@/stores/cart';
import { useMenu } from '@/hooks/useMenu';
import { CategoryBar } from '@/components/pos/CategoryBar';
import { ProductGrid } from '@/components/pos/ProductGrid';

// --- POS Terminal ---------------------------------------------------------
// Chunks:
//  - chunk 1: shell + header (done)
//  - chunk 2 (this): product grid + category filter + live search
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

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');

  const menu = useMenu();

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
          <ErrorState message={menu.error instanceof Error ? menu.error.message : 'Menu failed to load'} />
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
// Header — search input, order-type toggle, table number input.
// -------------------------------------------------------------------------
function PosHeader({
  search,
  onSearch,
  type,
  onTypeChange,
  tableNumber,
  onTableChange,
}: {
  search: string;
  onSearch: (s: string) => void;
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
