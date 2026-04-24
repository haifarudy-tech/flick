import { T } from '@/tokens';
import { Pill } from '@/components/ui/Pill';
import { fmt } from '@/lib/format';
import type { Order } from '@/types/order';
import { ORDER_TYPE_LABEL, PLATFORM_META } from '@/types/order';
import type { OrderStatus } from '@flick/shared/types';

export interface OrderCardProps {
  order: Order;
  onClick: () => void;
  onBump: () => void;
  onCancel: () => void;
  nextStatus: OrderStatus | null;
  accentColor: string;
  bumping: boolean;
}

function nextLabel(status: OrderStatus): string {
  switch (status) {
    case 'NEW':
      return 'Accept →';
    case 'PREPARING':
      return 'Mark Ready →';
    case 'READY':
      return 'Complete ✓';
    default:
      return '';
  }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OrderCard({
  order,
  onClick,
  onBump,
  onCancel,
  nextStatus,
  accentColor,
  bumping,
}: OrderCardProps) {
  const meta = PLATFORM_META[order.source];
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 14,
        borderLeft: `3px solid ${meta.color}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = T.cardHover)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = T.card)}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 10,
          gap: 8,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{meta.icon}</span>
            <span style={{ fontWeight: 900, fontSize: 15 }}>#{order.orderNumber}</span>
          </div>
          {order.type === 'DINE_IN' && order.tableNumber && (
            <div style={{ fontSize: 12, color: T.accent, fontWeight: 700, marginTop: 2 }}>
              Table {order.tableNumber}
            </div>
          )}
          {order.type === 'DELIVERY' && order.customerName && (
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginTop: 2 }}>
              {order.customerName}
            </div>
          )}
          {order.type === 'TAKEAWAY' && (
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginTop: 2 }}>
              {ORDER_TYPE_LABEL[order.type]}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 11, color: T.textDim }}>{formatTime(order.createdAt)}</div>
          <Pill color={meta.color}>{meta.label}</Pill>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {order.items.slice(0, 4).map((it) => (
          <div
            key={it.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: T.bg,
              borderRadius: 8,
              padding: '6px 10px',
            }}
          >
            <span style={{ fontWeight: 900, color: T.accent, fontSize: 13, minWidth: 22 }}>
              {it.quantity}×
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {it.name}
            </span>
          </div>
        ))}
        {order.items.length > 4 && (
          <div style={{ fontSize: 11, color: T.textDim, fontWeight: 600, paddingLeft: 10 }}>
            + {order.items.length - 4} more — {itemCount} items total
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: nextStatus ? 10 : 0,
        }}
      >
        <div>
          <span style={{ fontWeight: 900, fontSize: 16, color: T.accent }}>
            {fmt(order.total)}
          </span>
          {order.netAfterCommission != null && order.source !== 'POS' && (
            <span style={{ fontSize: 10, color: T.green, marginLeft: 8, fontWeight: 700 }}>
              net {fmt(order.netAfterCommission)}
            </span>
          )}
        </div>
      </div>

      {nextStatus && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBump();
            }}
            disabled={bumping}
            style={{
              flex: 1,
              padding: '9px',
              background: `${accentColor}15`,
              border: `1px solid ${accentColor}50`,
              color: accentColor,
              borderRadius: 10,
              cursor: bumping ? 'wait' : 'pointer',
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'inherit',
              opacity: bumping ? 0.6 : 1,
            }}
          >
            {nextLabel(order.status)}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            title="Cancel order"
            style={{
              width: 40,
              padding: '9px 0',
              background: 'transparent',
              border: `1px solid ${T.border}`,
              color: T.textDim,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
