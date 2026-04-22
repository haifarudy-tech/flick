import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { fmt } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { useCartStore, computeTotals } from '@/stores/cart';

export type PaymentMethod = 'CARD' | 'CASH' | 'SPLIT';

export interface CheckoutResult {
  method: PaymentMethod;
  cashTendered?: number;
  change?: number;
  splitCard?: number;
  splitCash?: number;
}

// Checkout view — takes over the right rail when the user taps Charge.
// Submits back via onConfirm; the parent handles the network call.

export function CheckoutPanel({
  onBack,
  onConfirm,
  submitting,
}: {
  onBack: () => void;
  onConfirm: (result: CheckoutResult) => void;
  submitting: boolean;
}) {
  const lines = useCartStore((s) => s.lines);
  const discountPercent = useCartStore((s) => s.discountPercent);
  const totals = computeTotals(lines, discountPercent, 0);

  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [cash, setCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [splitCash, setSplitCash] = useState('');

  const change = useMemo(() => {
    const n = parseFloat(cash);
    if (!Number.isFinite(n)) return 0;
    return n - totals.total;
  }, [cash, totals.total]);

  const splitRemaining = useMemo(() => {
    const paid = (parseFloat(splitCard) || 0) + (parseFloat(splitCash) || 0);
    return totals.total - paid;
  }, [splitCard, splitCash, totals.total]);

  const canConfirm =
    lines.length > 0 &&
    !submitting &&
    (method === 'CARD' ||
      (method === 'CASH' && change >= 0 && cash !== '') ||
      (method === 'SPLIT' && Math.abs(splitRemaining) < 0.005));

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (method === 'CASH') {
      onConfirm({ method, cashTendered: parseFloat(cash), change });
    } else if (method === 'SPLIT') {
      onConfirm({
        method,
        splitCard: parseFloat(splitCard) || 0,
        splitCash: parseFloat(splitCash) || 0,
      });
    } else {
      onConfirm({ method });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          onClick={onBack}
          disabled={submitting}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.textMid,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: 20,
            padding: 0,
          }}
        >
          ←
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Checkout</div>
          <div className="num" style={{ fontSize: 11, color: T.textDim }}>
            {fmt(totals.total)} due
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <Label>Payment method</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(
              [
                { k: 'CARD', l: 'Card', i: '💳' },
                { k: 'CASH', l: 'Cash', i: '💷' },
                { k: 'SPLIT', l: 'Split', i: '⟺' },
              ] as const
            ).map((m) => {
              const active = method === m.k;
              return (
                <button
                  key={m.k}
                  onClick={() => setMethod(m.k)}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    border: active ? `1px solid ${T.accent}55` : `1px solid ${T.border}`,
                    background: active ? T.accentGlow : T.card,
                    color: active ? T.accent : T.textMid,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{m.i}</span>
                  {m.l}
                </button>
              );
            })}
          </div>
        </div>

        {method === 'CARD' && (
          <div
            style={{
              background: T.accentGlow,
              border: `1px solid ${T.accent}35`,
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 22 }}>💳</div>
            <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5 }}>
              <div style={{ color: T.accent, fontWeight: 800, marginBottom: 2 }}>
                Card on Stripe Terminal
              </div>
              The in-browser Stripe Terminal reader wires up in session 5.
              Confirm now to record the order and mark payment as pending.
            </div>
          </div>
        )}

        {method === 'CASH' && (
          <div>
            <Label>Cash tendered</Label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: T.textMid,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                £
              </span>
              <input
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                className="num"
                style={{
                  width: '100%',
                  background: T.card,
                  border: `1px solid ${T.borderLight}`,
                  borderRadius: 10,
                  padding: '12px 12px 12px 28px',
                  color: T.text,
                  fontSize: 22,
                  fontWeight: 800,
                  outline: 'none',
                  fontFamily: '"DM Mono", monospace',
                }}
              />
            </div>
            {cash !== '' && change >= 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '10px 14px',
                  background: 'rgba(78,168,107,0.12)',
                  borderRadius: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: T.green, fontSize: 13, fontWeight: 700 }}>Change due</span>
                <span
                  className="num"
                  style={{ color: T.green, fontSize: 16, fontWeight: 900 }}
                >
                  {fmt(change)}
                </span>
              </div>
            )}
            {cash !== '' && change < 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '10px 14px',
                  background: 'rgba(201,84,84,0.12)',
                  borderRadius: 10,
                  color: T.red,
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                {fmt(-change)} short
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {[totals.total, Math.ceil(totals.total / 5) * 5, Math.ceil(totals.total / 10) * 10, 20, 50].map(
                (preset, i) => (
                  <button
                    key={i}
                    onClick={() => setCash(preset.toFixed(2))}
                    className="num"
                    style={{
                      flex: '1 1 auto',
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      color: T.textMid,
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'inherit',
                    }}
                  >
                    £{preset.toFixed(2)}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {method === 'SPLIT' && (
          <div>
            <Label>Split payment</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SplitInput
                label="Card"
                value={splitCard}
                onChange={setSplitCard}
                leadingIcon="💳"
              />
              <SplitInput
                label="Cash"
                value={splitCash}
                onChange={setSplitCash}
                leadingIcon="💷"
              />
            </div>
            <div
              style={{
                marginTop: 10,
                padding: '10px 14px',
                background: Math.abs(splitRemaining) < 0.005 ? 'rgba(78,168,107,0.12)' : T.card,
                border: `1px solid ${
                  Math.abs(splitRemaining) < 0.005 ? `${T.green}35` : T.border
                }`,
                borderRadius: 10,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  color: Math.abs(splitRemaining) < 0.005 ? T.green : T.textMid,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {Math.abs(splitRemaining) < 0.005
                  ? '✓ Balanced'
                  : splitRemaining > 0
                  ? 'Remaining'
                  : 'Over-paid'}
              </span>
              <span
                className="num"
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: Math.abs(splitRemaining) < 0.005 ? T.green : T.text,
                }}
              >
                {fmt(Math.abs(splitRemaining))}
              </span>
            </div>
          </div>
        )}

        <OrderSummary />
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <Button full disabled={!canConfirm} onClick={handleConfirm}>
          {submitting ? 'Sending…' : 'Confirm & send order'}
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: T.textDim,
        marginBottom: 8,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}
    >
      {children}
    </div>
  );
}

function SplitInput({
  label,
  value,
  onChange,
  leadingIcon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  leadingIcon: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: T.textMid,
          marginBottom: 4,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          fontWeight: 600,
        }}
      >
        <span>{leadingIcon}</span> {label}
      </div>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: T.textMid,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          £
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          className="num"
          style={{
            width: '100%',
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '10px 12px 10px 26px',
            color: T.text,
            fontSize: 15,
            fontWeight: 800,
            outline: 'none',
            fontFamily: '"DM Mono", monospace',
          }}
        />
      </div>
    </div>
  );
}

function OrderSummary() {
  const lines = useCartStore((s) => s.lines);
  const discountPercent = useCartStore((s) => s.discountPercent);
  const totals = computeTotals(lines, discountPercent, 0);
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 12,
        padding: 14,
        border: `1px solid ${T.border}`,
      }}
    >
      {lines.map((line) => (
        <div
          key={line.menuItemId}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: T.textMid,
            marginBottom: 4,
          }}
        >
          <span>
            {line.quantity}× {line.name}
          </span>
          <span className="num">{fmt(line.unitPrice * line.quantity)}</span>
        </div>
      ))}
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 900,
          fontSize: 17,
        }}
      >
        <span>Total</span>
        <span className="num" style={{ color: T.accent }}>
          {fmt(totals.total)}
        </span>
      </div>
    </div>
  );
}
