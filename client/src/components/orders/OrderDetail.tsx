import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { fmt } from '@/lib/format';
import { api } from '@/lib/api';
import type { Order, OrderPayment } from '@/types/order';
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CARD: '💳 Card',
  CASH: '💷 Cash',
  SPLIT: '⟺ Split',
};

export interface OrderDetailProps {
  order: Order;
  onClose: () => void;
  onTransition: (status: OrderStatus) => void;
  transitioning: boolean;
}

const TRANSITIONS: OrderStatus[] = ['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

export function OrderDetail({ order, onClose, onTransition, transitioning }: OrderDetailProps) {
  const meta = PLATFORM_META[order.source];
  const [refundPayment, setRefundPayment] = useState<OrderPayment | null>(null);

  const refundablePayments = order.payments.filter(
    (p) => p.status === 'COMPLETED' && (p.method === 'CARD' || p.method === 'CASH'),
  );
  const canRefund = order.status === 'COMPLETED' && refundablePayments.length > 0;

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
        {/* Header */}
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

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Customer info */}
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
              {order.customerName && <Row label="Customer" value={order.customerName} />}
              {order.customerPhone && <Row label="Phone" value={order.customerPhone} />}
              {order.deliveryAddress && <Row label="Address" value={order.deliveryAddress} />}
            </div>
          )}

          {/* Items */}
          <SectionTitle>Items</SectionTitle>
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
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}
                      >
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

          {/* Money breakdown */}
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 16,
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
            <div style={{ height: 1, background: T.border, margin: '4px 0' }} />
            <Row label="Total" value={fmt(order.total)} bold />
            {order.netAfterCommission != null && order.source !== 'POS' && (
              <Row
                label={`Net after ${order.platformCommissionRate ?? 0}% fee`}
                value={fmt(order.netAfterCommission)}
                color={T.green}
              />
            )}
          </div>

          {/* Payments */}
          {order.payments.length > 0 && (
            <>
              <SectionTitle>Payments</SectionTitle>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                {order.payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: T.card,
                      border: `1px solid ${p.status === 'REFUNDED' ? T.red : T.border}`,
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                        {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                        {p.status === 'REFUNDED' && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              color: T.red,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            Refunded
                          </span>
                        )}
                        {p.status === 'PENDING' && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              color: T.gold,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            Pending
                          </span>
                        )}
                      </div>
                      {p.tip > 0 && (
                        <div style={{ fontSize: 11, color: T.green }}>
                          incl. tip {fmt(p.tip)}
                        </div>
                      )}
                      {p.change > 0 && (
                        <div style={{ fontSize: 11, color: T.textDim }}>
                          change {fmt(p.change)}
                        </div>
                      )}
                    </div>
                    <div
                      className="num"
                      style={{
                        fontWeight: 900,
                        fontSize: 15,
                        color: p.status === 'REFUNDED' ? T.red : T.text,
                      }}
                    >
                      {fmt(p.amount + p.tip)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Refund section */}
          {canRefund && (
            <div style={{ marginBottom: 16 }}>
              <SectionTitle>Refund</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {refundablePayments.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setRefundPayment(p)}
                    style={{
                      background: 'rgba(201,84,84,0.08)',
                      border: `1px solid ${T.red}30`,
                      borderRadius: 10,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 13, color: T.red, fontWeight: 700 }}>
                      Refund {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                    </span>
                    <span className="num" style={{ fontSize: 13, color: T.red, fontWeight: 900 }}>
                      {fmt(p.amount + p.tip)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div
              style={{
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

        {/* Footer — status transitions */}
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
                  s === 'CANCELLED' ? 'danger' : s === order.status ? 'primary' : 'secondary'
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

      {/* Refund modal */}
      {refundPayment && (
        <RefundModal
          payment={refundPayment}
          onClose={() => setRefundPayment(null)}
          onSuccess={() => {
            setRefundPayment(null);
            onClose();
          }}
        />
      )}
    </div>
  );
}

// ── Refund modal ──────────────────────────────────────────────────────────────

function RefundModal({
  payment,
  onClose,
  onSuccess,
}: {
  payment: OrderPayment;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const maxAmount = payment.amount + payment.tip;
  const [amount, setAmount] = useState(maxAmount.toFixed(2));
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'full' | 'partial'>('full');

  const refundAmount = mode === 'full' ? maxAmount : parseFloat(amount) || 0;
  const valid = refundAmount > 0 && refundAmount <= maxAmount;

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/payments/${payment.id}/refund`, {
        amount: refundAmount,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      onSuccess();
    },
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12,11,9,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Issue refund</div>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 20 }}>
          {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method} ·{' '}
          {payment.stripePaymentIntentId ? 'Card via Stripe' : 'Cash — logged manually'}
        </div>

        {/* Full / partial toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['full', 'partial'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                if (m === 'full') setAmount(maxAmount.toFixed(2));
              }}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 9,
                cursor: 'pointer',
                border: mode === m ? `1px solid ${T.red}55` : `1px solid ${T.border}`,
                background: mode === m ? 'rgba(201,84,84,0.1)' : T.surface,
                color: mode === m ? T.red : T.textMid,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
              }}
            >
              {m === 'full' ? `Full — ${fmt(maxAmount)}` : 'Partial amount'}
            </button>
          ))}
        </div>

        {mode === 'partial' && (
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Refund amount</FieldLabel>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: T.textMid,
                  fontWeight: 700,
                }}
              >
                £
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={maxAmount}
                step="0.01"
                className="num"
                style={{
                  width: '100%',
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: '10px 12px 10px 26px',
                  color: T.text,
                  fontSize: 16,
                  fontWeight: 800,
                  outline: 'none',
                  fontFamily: '"DM Mono", monospace',
                }}
              />
            </div>
            {refundAmount > maxAmount && (
              <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>
                Cannot exceed {fmt(maxAmount)}
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Reason (optional)</FieldLabel>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Wrong item, customer complaint…"
            style={{
              width: '100%',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: '10px 12px',
              color: T.text,
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(201,84,84,0.1)',
              border: `1px solid ${T.red}30`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              color: T.red,
              marginBottom: 16,
            }}
          >
            {error instanceof Error ? error.message : 'Refund failed. Try again.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" full onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" full onClick={() => mutate()} disabled={!valid || isPending}>
            {isPending ? 'Processing…' : `Refund ${fmt(refundAmount)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: T.textDim, fontWeight: 700, marginBottom: 6 }}>
      {children}
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
