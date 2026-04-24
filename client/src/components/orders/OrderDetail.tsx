import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { fmt } from '@/lib/format';
import type { Order } from '@/types/order';
import { ORDER_TYPE_LABEL, PLATFORM_META } from '@/types/order';
import type { OrderStatus } from '@flick/shared/types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'New',
  PREPARING: 'Preparing',
  READY: 'Ready',
  PICKED_UP: 'Picked up',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  NEW: T.red,
  PREPARING: T.gold,
  READY: T.accent,
  PICKED_UP: T.green,
  COMPLETED: T.green,
  CANCELLED: T.textDim,
};

export interface OrderDetailProps {
  order: Order;
  onClose: () => void;
  onTransition: (status: OrderStatus) => void;
  transitioning: boolean;
}

const TRANSITIONS: OrderStatus[] = [
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
];

export function OrderDetail({
  order,
  onClose,
  onTransition,
  transitioning,
}: OrderDetailProps) {
  const meta = PLATFORM_META[order.source];
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '100%',
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: T.textDim,
                fontWeight: 700,
                letterSpacing: '0.7px',
                textTransform: 'uppercase',
              }}
            >
              {ORDER_TYPE_LABEL[order.type]}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{meta.icon}</span>
              <span>#{order.orderNumber}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <Pill color={meta.color}>{meta.label}</Pill>
              <Pill color={STATUS_COLOR[order.status]}>{STATUS_LABEL[order.status]}</Pill>
              {order.type === 'DINE_IN' && order.tableNumber && (
                <Pill color={T.accent}>Table {order.tableNumber}</Pill>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: T.card,
              border: `1px solid ${T.border}`,
              color: T.textMid,
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {(order.customerName || order.customerPhone || order.deliveryAddress) && (
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {order.customerName && (
                <Row label="Customer" value={order.customerName} />
              )}
              {order.customerPhone && <Row label="Phone" value={order.customerPhone} />}
              {order.deliveryAddress && (
                <Row label="Address" value={order.deliveryAddress} />
              )}
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              color: T.textDim,
              fontWeight: 700,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Items
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {order.items.map((it) => (
              <div
                key={it.id}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ color: T.accent, fontWeight: 900 }}>{it.quantity}×</span>
                      <span>{it.name}</span>
                    </div>
                    {it.modifiers.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                        {it.modifiers.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              fontSize: 11,
                              color: T.textMid,
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>+ {m.modifierName}</span>
                            {m.priceAdd > 0 && (
                              <span style={{ color: T.textDim }}>+{fmt(m.priceAdd)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {it.notes && (
                      <div
                        style={{
                          fontSize: 11,
                          color: T.gold,
                          marginTop: 6,
                          padding: '4px 8px',
                          background: 'rgba(200,153,58,0.08)',
                          borderRadius: 6,
                          display: 'inline-block',
                        }}
                      >
                        ✎ {it.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, color: T.text }}>{fmt(it.totalPrice)}</div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <Row label="Subtotal" value={fmt(order.subtotal)} />
            {order.discountAmount > 0 && (
              <Row label="Discount" value={`-${fmt(order.discountAmount)}`} color={T.red} />
            )}
            <Row label="VAT" value={fmt(order.vatAmount)} />
            {order.deliveryFee != null && order.deliveryFee > 0 && (
              <Row label="Delivery fee" value={fmt(order.deliveryFee)} />
            )}
            <div
              style={{
                height: 1,
                background: T.border,
                margin: '4px 0',
              }}
            />
            <Row label="Total" value={fmt(order.total)} bold />
            {order.netAfterCommission != null && order.source !== 'POS' && (
              <Row
                label={`Net after ${order.platformCommissionRate ?? 0}% fee`}
                value={fmt(order.netAfterCommission)}
                color={T.green}
              />
            )}
          </div>

          {order.notes && (
            <div
              style={{
                marginTop: 16,
                background: 'rgba(200,153,58,0.08)',
                border: `1px solid ${T.gold}30`,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: T.gold, marginBottom: 4 }}>
                Notes
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{order.notes}</div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: T.textDim,
              fontWeight: 700,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
            }}
          >
            Move to
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TRANSITIONS.map((s) => (
              <Button
                key={s}
                small
                variant={
                  s === 'CANCELLED'
                    ? 'danger'
                    : s === order.status
                      ? 'primary'
                      : 'secondary'
                }
                onClick={() => onTransition(s)}
                disabled={transitioning || s === order.status}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
        color: T.textMid,
      }}
    >
      <span>{label}</span>
      <span style={{ color: color ?? T.text, fontWeight: bold ? 900 : 600 }}>{value}</span>
    </div>
  );
}
