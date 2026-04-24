import { useCallback, useMemo, useRef, useState } from 'react';
import { T } from '@/tokens';
import { LiveDot } from '@/components/ui/LiveDot';
import { useToast } from '@/components/ui/Toast';
import { useOrders, useOrderSocket, useUpdateOrderStatus } from '@/hooks/useOrders';
import { ApiError } from '@/lib/api';
import type { Order } from '@/types/order';
import { PLATFORM_META } from '@/types/order';
import type { OrderSource, OrderStatus, OrderType } from '@flick/shared/types';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderDetail } from '@/components/orders/OrderDetail';

type ColStatus = 'NEW' | 'PREPARING' | 'READY' | 'COMPLETED';

interface Column {
  key: ColStatus;
  label: string;
  color: string;
  matches: OrderStatus[];
  next: OrderStatus | null;
}

const COLUMNS: Column[] = [
  { key: 'NEW', label: 'New', color: T.red, matches: ['NEW'], next: 'PREPARING' },
  {
    key: 'PREPARING',
    label: 'Preparing',
    color: T.gold,
    matches: ['PREPARING'],
    next: 'READY',
  },
  {
    key: 'READY',
    label: 'Ready',
    color: T.accent,
    matches: ['READY'],
    next: 'COMPLETED',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    color: T.green,
    matches: ['COMPLETED', 'PICKED_UP'],
    next: null,
  },
];

const SOURCES: Array<{ key: 'all' | OrderSource; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'POS', label: PLATFORM_META.POS.label },
  { key: 'UBER_EATS', label: PLATFORM_META.UBER_EATS.label },
  { key: 'DELIVEROO', label: PLATFORM_META.DELIVEROO.label },
  { key: 'JUST_EAT', label: PLATFORM_META.JUST_EAT.label },
  { key: 'DIRECT_QR', label: PLATFORM_META.DIRECT_QR.label },
];

const TYPES: Array<{ key: 'all' | OrderType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'DINE_IN', label: 'Dine In' },
  { key: 'TAKEAWAY', label: 'Takeaway' },
  { key: 'DELIVERY', label: 'Delivery' },
];

// Subtle pop on new platform orders; built in the browser so no asset is
// required. Kept quiet on purpose.
function playDing() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    o.type = 'sine';
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* swallow — audio is nice-to-have */
  }
}

export function OrdersPage() {
  const { data, isLoading } = useOrders();
  const toast = useToast();
  const updateStatus = useUpdateOrderStatus();

  const [filterSource, setFilterSource] = useState<'all' | OrderSource>('all');
  const [filterType, setFilterType] = useState<'all' | OrderType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const onNewOrder = useCallback(
    (order: Order) => {
      if (seenIds.current.has(order.id)) return;
      seenIds.current.add(order.id);
      if (order.source !== 'POS') {
        playDing();
        toast.info(
          `${PLATFORM_META[order.source].label} order #${order.orderNumber}`,
        );
      }
    },
    [toast],
  );

  useOrderSocket({ onNewOrder });

  const orders = data?.orders ?? [];

  // Pre-filter before splitting into columns.
  const filtered = useMemo(() => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    return orders.filter((o) => {
      if (filterSource !== 'all' && o.source !== filterSource) return false;
      if (filterType !== 'all' && o.type !== filterType) return false;
      // Hide completed orders older than 15 minutes to keep the board fresh.
      if (
        (o.status === 'COMPLETED' || o.status === 'PICKED_UP') &&
        new Date(o.completedAt ?? o.updatedAt).getTime() < cutoff
      ) {
        return false;
      }
      if (o.status === 'CANCELLED') return false;
      return true;
    });
  }, [orders, filterSource, filterType]);

  const byColumn = useMemo(() => {
    const map = new Map<ColStatus, Order[]>();
    COLUMNS.forEach((c) => map.set(c.key, []));
    for (const o of filtered) {
      const col = COLUMNS.find((c) => c.matches.includes(o.status));
      if (col) map.get(col.key)?.push(o);
    }
    return map;
  }, [filtered]);

  const activeCount = filtered.filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'PICKED_UP',
  ).length;

  const bump = async (order: Order, next: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id: order.id, status: next });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update order');
    }
  };

  const cancel = async (order: Order) => {
    try {
      await updateStatus.mutateAsync({ id: order.id, status: 'CANCELLED' });
      toast.success(`Order #${order.orderNumber} cancelled`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not cancel');
    }
  };

  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Live Orders</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textDim }}>
            {activeCount} active · synced live
          </p>
        </div>
        <LiveDot />
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '10px 20px',
          background: T.bg,
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <FilterGroup
          label="Source"
          options={SOURCES}
          value={filterSource}
          onChange={(v) => setFilterSource(v as 'all' | OrderSource)}
        />
        <FilterGroup
          label="Type"
          options={TYPES}
          value={filterType}
          onChange={(v) => setFilterType(v as 'all' | OrderType)}
        />
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>
            Loading orders…
          </div>
        )}
        {!isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, minWidth: 960 }}>
            {COLUMNS.map((col) => {
              const ordersInCol = byColumn.get(col.key) ?? [];
              return (
                <div key={col.key} style={{ display: 'flex', flexDirection: 'column', minHeight: 200 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: col.color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: T.textMid,
                        textTransform: 'uppercase',
                        letterSpacing: '0.7px',
                      }}
                    >
                      {col.label}
                    </span>
                    <span
                      style={{
                        background: T.card,
                        border: `1px solid ${T.border}`,
                        borderRadius: 20,
                        padding: '1px 8px',
                        fontSize: 10,
                        color: T.textDim,
                      }}
                    >
                      {ordersInCol.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ordersInCol.length === 0 ? (
                      <div
                        style={{
                          border: `1px dashed ${T.border}`,
                          borderRadius: 14,
                          padding: 24,
                          textAlign: 'center',
                          color: T.textDim,
                          fontSize: 13,
                        }}
                      >
                        No orders here
                      </div>
                    ) : (
                      ordersInCol.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          accentColor={col.color}
                          nextStatus={col.next}
                          bumping={
                            updateStatus.isPending &&
                            updateStatus.variables?.id === order.id
                          }
                          onClick={() => setSelectedId(order.id)}
                          onBump={() => col.next && bump(order, col.next)}
                          onCancel={() => cancel(order)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelectedId(null)}
          onTransition={async (status) => {
            try {
              await updateStatus.mutateAsync({ id: selected.id, status });
              toast.success(`Moved to ${status.toLowerCase()}`);
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not update');
            }
          }}
          transitioning={updateStatus.isPending}
        />
      )}
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          color: T.textDim,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              style={{
                padding: '5px 11px',
                borderRadius: 9,
                border: active ? `1px solid ${T.accent}50` : `1px solid ${T.border}`,
                background: active ? T.accentGlow : 'transparent',
                color: active ? T.accent : T.textMid,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
