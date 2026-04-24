import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { fmt } from '@/lib/format';
import { PLATFORM_META } from '@/types/order';
import { useUpdateOrderStatus } from '@/hooks/useOrders';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { Order } from '@/types/order';
import type { OrderSource, OrderStatus } from '@flick/shared/types';

type FilterKey = 'all' | OrderSource;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'UBER_EATS', label: 'Uber Eats' },
  { key: 'DELIVEROO', label: 'Deliveroo' },
  { key: 'JUST_EAT', label: 'Just Eat' },
  { key: 'DIRECT_QR', label: 'Direct QR' },
];

// Status → (label, next-status) pairs used by the Accept/Preparing/Ready buttons.
const NEXT_STATUS: Record<OrderStatus, { label: string; next: OrderStatus | null }> = {
  NEW: { label: 'Accept', next: 'PREPARING' },
  PREPARING: { label: 'Mark Ready', next: 'READY' },
  READY: { label: 'Picked Up', next: 'PICKED_UP' },
  PICKED_UP: { label: 'Done', next: null },
  COMPLETED: { label: 'Done', next: null },
  CANCELLED: { label: '—', next: null },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DeliveryLiveOrdersTab({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const updateStatus = useUpdateOrderStatus();
  const toast = useToast();

  const visible = useMemo(() => {
    // Hide old completed / cancelled orders. Keep it simple: last 24h.
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return orders
      .filter((o) => new Date(o.createdAt).getTime() >= cutoff)
      .filter((o) => o.status !== 'CANCELLED')
      .filter((o) => filter === 'all' || o.source === filter)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, filter]);

  const handleBump = async (order: Order) => {
    const next = NEXT_STATUS[order.status].next;
    if (!next) return;
    try {
      await updateStatus.mutateAsync({ id: order.id, status: next });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update order');
    }
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Platform filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: '7px 14px',
                borderRadius: 20,
                border: active
                  ? `1px solid ${T.accent}60`
                  : `1px solid ${T.border}`,
                background: active ? T.accentGlow : T.card,
                color: active ? T.accent : T.textMid,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Order cards */}
      {visible.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            color: T.textDim,
            border: `1px dashed ${T.border}`,
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 30, opacity: 0.4, marginBottom: 8 }}>🛵</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
            No delivery orders yet
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Orders from Uber Eats, Deliveroo, Just Eat and Direct QR will appear
            here in real time.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {visible.map((order) => (
            <DeliveryOrderCard
              key={order.id}
              order={order}
              onBump={() => handleBump(order)}
              bumping={
                updateStatus.isPending &&
                updateStatus.variables?.id === order.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryOrderCard({
  order,
  onBump,
  bumping,
}: {
  order: Order;
  onBump: () => void;
  bumping: boolean;
}) {
  const meta = PLATFORM_META[order.source];
  const net = order.netAfterCommission ?? order.total;
  const commission = order.total - net;
  const { label, next } = NEXT_STATUS[order.status];

  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 14,
        borderLeft: `3px solid ${meta.color}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header: platform + order # + time */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{meta.icon}</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>
              #{order.orderNumber}
            </div>
            <div
              style={{
                fontSize: 10,
                color: meta.color,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}
            >
              {meta.label}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: T.textDim }}>
            {fmtTime(order.createdAt)}
          </div>
          <StatusPill status={order.status} />
        </div>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {order.items.slice(0, 3).map((it) => (
          <div
            key={it.id}
            style={{
              display: 'flex',
              gap: 8,
              fontSize: 12,
              color: T.text,
            }}
          >
            <span
              style={{
                color: T.accent,
                fontWeight: 800,
                minWidth: 22,
              }}
            >
              {it.quantity}×
            </span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {it.name}
            </span>
          </div>
        ))}
        {order.items.length > 3 && (
          <div style={{ fontSize: 11, color: T.textDim, paddingLeft: 30 }}>
            + {order.items.length - 3} more
          </div>
        )}
      </div>

      {/* Address */}
      {order.deliveryAddress && (
        <div
          style={{
            fontSize: 11,
            color: T.textMid,
            background: T.bg,
            padding: '6px 10px',
            borderRadius: 8,
            display: 'flex',
            gap: 6,
          }}
        >
          <span>📍</span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {order.deliveryAddress}
          </span>
        </div>
      )}

      {/* Money */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${T.border}`,
          paddingTop: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: T.textDim, fontWeight: 700 }}>
            GROSS
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }} className="num">
            {fmt(order.total)}
          </div>
        </div>
        {commission > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: T.textDim, fontWeight: 700 }}>
              COMM
            </div>
            <div
              style={{ fontSize: 13, fontWeight: 700, color: T.red }}
              className="num"
            >
              −{fmt(commission)}
            </div>
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: T.textDim, fontWeight: 700 }}>
            NET
          </div>
          <div
            style={{ fontSize: 15, fontWeight: 800, color: T.green }}
            className="num"
          >
            {fmt(net)}
          </div>
        </div>
      </div>

      {/* Action */}
      {next && (
        <button
          type="button"
          onClick={onBump}
          disabled={bumping}
          style={{
            padding: '10px',
            background: `${T.accent}15`,
            border: `1px solid ${T.accent}50`,
            color: T.accent,
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 800,
            cursor: bumping ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: bumping ? 0.6 : 1,
          }}
        >
          {label} →
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    NEW: T.red,
    PREPARING: T.gold,
    READY: T.accent,
    PICKED_UP: T.green,
    COMPLETED: T.green,
    CANCELLED: T.textDim,
  };
  const color = colors[status];
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: 3,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 20,
        background: `${color}20`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
