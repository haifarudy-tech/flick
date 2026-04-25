import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { fmt } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { useCartStore, computeTotals } from '@/stores/cart';
import type { TerminalStage } from '@/lib/stripeTerminal';
import { TERMINAL_STAGE_LABEL } from '@/lib/stripeTerminal';

export type PaymentMethod = 'CARD' | 'CASH' | 'SPLIT';

export interface CheckoutResult {
  method: PaymentMethod;
  tip: number;
  cashTendered?: number;
  change?: number;
  splitCard?: number;
  splitCash?: number;
}

// Terminal progress shown inside the panel while Pos.tsx drives the card flow.
export interface CardPaymentState {
  stage: TerminalStage;
  error: string | null;
}

export function CheckoutPanel({
  onBack,
  onConfirm,
  submitting,
  cardPaymentState,
  onCancelCard,
}: {
  onBack: () => void;
  onConfirm: (result: CheckoutResult) => void;
  submitting: boolean;
  cardPaymentState?: CardPaymentState | null;
  onCancelCard?: () => void;
}) {
  const lines = useCartStore((s) => s.lines);
  const discountPercent = useCartStore((s) => s.discountPercent);
  const totals = computeTotals(lines, discountPercent, 0);

  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [cash, setCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [splitCash, setSplitCash] = useState('');

  // Tip state
  const [tipMode, setTipMode] = useState<'none' | '10' | '15' | '20' | 'custom'>('none');
  const [customTip, setCustomTip] = useState('');

  const tip = useMemo(() => {
    if (tipMode === 'none') return 0;
    if (tipMode === 'custom') return parseFloat(customTip) || 0;
    return parseFloat((totals.total * (parseInt(tipMode) / 100)).toFixed(2));
  }, [tipMode, customTip, totals.total]);

  const grandTotal = totals.total + tip;

  const change = useMemo(() => {
    const n = parseFloat(cash);
    if (!Number.isFinite(n)) return 0;
    return n - grandTotal;
  }, [cash, grandTotal]);

  const splitRemaining = useMemo(() => {
    const paid = (parseFloat(splitCard) || 0) + (parseFloat(splitCash) || 0);
    return grandTotal - paid;
  }, [splitCard, splitCash, grandTotal]);

  const canConfirm =
    lines.length > 0 &&
    !submitting &&
    !cardPaymentState &&
    (method === 'CARD' ||
      (method === 'CASH' && change >= 0 && cash !== '') ||
      (method === 'SPLIT' && Math.abs(splitRemaining) < 0.005));

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (method === 'CASH') {
      onConfirm({ method, tip, cashTendered: parseFloat(cash), change });
    } else if (method === 'SPLIT') {
      onConfirm({
        method,
        tip,
        splitCard: parseFloat(splitCard) || 0,
        splitCash: parseFloat(splitCash) || 0,
      });
    } else {
      onConfirm({ method, tip });
    }
  };

  // While terminal is processing, replace the panel body with progress UI
  if (cardPaymentState) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PanelHeader onBack={undefined} submitting={true} grandTotal={grandTotal} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
          }}
        >
          <TerminalProgress state={cardPaymentState} />
          {cardPaymentState.stage === 'error' && onCancelCard && (
            <Button variant="secondary" onClick={onCancelCard}>
              Try again
            </Button>
          )}
          {(cardPaymentState.stage === 'collecting' ||
            cardPaymentState.stage === 'ready' ||
            cardPaymentState.stage === 'loading_sdk' ||
            cardPaymentState.stage === 'discovering' ||
            cardPaymentState.stage === 'connecting') &&
            onCancelCard && (
              <Button variant="ghost" small onClick={onCancelCard}>
                Cancel
              </Button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelHeader onBack={onBack} submitting={submitting} grandTotal={grandTotal} />

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
        {/* ── Tip ─────────────────────────────────────── */}
        <TipSection
          tipMode={tipMode}
          setTipMode={setTipMode}
          customTip={customTip}
          setCustomTip={setCustomTip}
          tip={tip}
          orderTotal={totals.total}
        />

        {/* ── Payment method ──────────────────────────── */}
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

        {/* ── Card ────────────────────────────────────── */}
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
            <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.6 }}>
              <div style={{ color: T.accent, fontWeight: 800, marginBottom: 2 }}>
                Stripe Terminal
              </div>
              Tap <strong>Charge Card</strong> to connect the simulated reader and process the
              payment. The reader auto-accepts in test mode.
            </div>
          </div>
        )}

        {/* ── Cash ────────────────────────────────────── */}
        {method === 'CASH' && (
          <CashSection
            cash={cash}
            setCash={setCash}
            change={change}
            grandTotal={grandTotal}
          />
        )}

        {/* ── Split ───────────────────────────────────── */}
        {method === 'SPLIT' && (
          <SplitSection
            splitCard={splitCard}
            setSplitCard={setSplitCard}
            splitCash={splitCash}
            setSplitCash={setSplitCash}
            splitRemaining={splitRemaining}
            grandTotal={grandTotal}
          />
        )}

        <OrderSummary tip={tip} />
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <Button full disabled={!canConfirm} onClick={handleConfirm}>
          {submitting
            ? 'Processing…'
            : method === 'CARD'
            ? `Charge Card · ${fmt(grandTotal)}`
            : method === 'CASH'
            ? `Confirm Cash · ${fmt(grandTotal)}`
            : `Confirm Split · ${fmt(grandTotal)}`}
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PanelHeader({
  onBack,
  submitting,
  grandTotal,
}: {
  onBack: (() => void) | undefined;
  submitting: boolean;
  grandTotal: number;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {onBack && (
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
      )}
      <div>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Checkout</div>
        <div className="num" style={{ fontSize: 11, color: T.textDim }}>
          {fmt(grandTotal)} due
        </div>
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

// ─── Tip ─────────────────────────────────────────────────────────────────────

function TipSection({
  tipMode,
  setTipMode,
  customTip,
  setCustomTip,
  tip,
  orderTotal,
}: {
  tipMode: 'none' | '10' | '15' | '20' | 'custom';
  setTipMode: (v: 'none' | '10' | '15' | '20' | 'custom') => void;
  customTip: string;
  setCustomTip: (v: string) => void;
  tip: number;
  orderTotal: number;
}) {
  const presets = [
    { k: 'none' as const, l: 'No tip' },
    { k: '10' as const, l: '10%' },
    { k: '15' as const, l: '15%' },
    { k: '20' as const, l: '20%' },
    { k: 'custom' as const, l: 'Custom' },
  ];

  return (
    <div>
      <Label>
        Tip{tip > 0 ? ` — ${fmt(tip)}` : ''}
      </Label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {presets.map((p) => {
          const active = tipMode === p.k;
          const preview =
            p.k !== 'none' && p.k !== 'custom'
              ? ` (${fmt(orderTotal * (parseInt(p.k) / 100))})`
              : '';
          return (
            <button
              key={p.k}
              onClick={() => setTipMode(p.k)}
              style={{
                flex: '1 1 auto',
                padding: '8px 6px',
                borderRadius: 9,
                cursor: 'pointer',
                border: active ? `1px solid ${T.accent}55` : `1px solid ${T.border}`,
                background: active ? T.accentGlow : T.card,
                color: active ? T.accent : T.textMid,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {p.l}{preview}
            </button>
          );
        })}
      </div>
      {tipMode === 'custom' && (
        <div style={{ position: 'relative', marginTop: 8 }}>
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
            value={customTip}
            onChange={(e) => setCustomTip(e.target.value)}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            className="num"
            autoFocus
            style={{
              width: '100%',
              background: T.card,
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
      )}
    </div>
  );
}

// ─── Cash ────────────────────────────────────────────────────────────────────

function CashSection({
  cash,
  setCash,
  change,
  grandTotal,
}: {
  cash: string;
  setCash: (v: string) => void;
  change: number;
  grandTotal: number;
}) {
  return (
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
          <span className="num" style={{ color: T.green, fontSize: 16, fontWeight: 900 }}>
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
        {[
          grandTotal,
          Math.ceil(grandTotal / 5) * 5,
          Math.ceil(grandTotal / 10) * 10,
          20,
          50,
        ].map((preset, i) => (
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
        ))}
      </div>
    </div>
  );
}

// ─── Split ───────────────────────────────────────────────────────────────────

function SplitSection({
  splitCard,
  setSplitCard,
  splitCash,
  setSplitCash,
  splitRemaining,
  grandTotal,
}: {
  splitCard: string;
  setSplitCard: (v: string) => void;
  splitCash: string;
  setSplitCash: (v: string) => void;
  splitRemaining: number;
  grandTotal: number;
}) {
  const balanced = Math.abs(splitRemaining) < 0.005;
  return (
    <div>
      <Label>Split payment</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SplitInput label="Card (via Terminal)" value={splitCard} onChange={setSplitCard} leadingIcon="💳" />
        <SplitInput label="Cash" value={splitCash} onChange={setSplitCash} leadingIcon="💷" />
      </div>
      <div
        style={{
          marginTop: 10,
          padding: '10px 14px',
          background: balanced ? 'rgba(78,168,107,0.12)' : T.card,
          border: `1px solid ${balanced ? `${T.green}35` : T.border}`,
          borderRadius: 10,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ color: balanced ? T.green : T.textMid, fontSize: 13, fontWeight: 700 }}>
          {balanced ? '✓ Balanced' : splitRemaining > 0 ? 'Remaining' : 'Over-paid'}
        </span>
        <span className="num" style={{ fontSize: 14, fontWeight: 900, color: balanced ? T.green : T.text }}>
          {fmt(Math.abs(splitRemaining))}
        </span>
      </div>
      {!balanced && (parseFloat(splitCard) || 0) > 0 && (
        <button
          onClick={() => setSplitCash(splitRemaining.toFixed(2))}
          style={{
            marginTop: 6,
            fontSize: 11,
            color: T.accent,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 700,
          }}
        >
          Fill cash with remaining {fmt(Math.abs(splitRemaining))}
        </button>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>
        Card leg processed via Terminal · Cash recorded manually
      </div>
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

// ─── Order summary ────────────────────────────────────────────────────────────

function OrderSummary({ tip }: { tip: number }) {
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
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMid }}>
          <span>Subtotal</span>
          <span className="num">{fmt(totals.subtotal)}</span>
        </div>
        {totals.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.red }}>
            <span>Discount</span>
            <span className="num">-{fmt(totals.discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMid }}>
          <span>VAT</span>
          <span className="num">{fmt(totals.vat)}</span>
        </div>
        {tip > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.green }}>
            <span>Tip</span>
            <span className="num">{fmt(tip)}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 900,
            fontSize: 17,
            marginTop: 4,
          }}
        >
          <span>Total</span>
          <span className="num" style={{ color: T.accent }}>
            {fmt(totals.total + tip)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Terminal progress ────────────────────────────────────────────────────────

const STAGE_ICON: Record<string, string> = {
  idle: '●',
  loading_sdk: '⟳',
  discovering: '⟳',
  connecting: '⟳',
  ready: '✓',
  collecting: '💳',
  processing: '⟳',
  capturing: '⟳',
  success: '✓',
  error: '✕',
};

function TerminalProgress({ state }: { state: CardPaymentState }) {
  const isSuccess = state.stage === 'success';
  const isError = state.stage === 'error';
  const color = isSuccess ? T.green : isError ? T.red : T.accent;

  return (
    <div
      style={{
        width: '100%',
        background: T.card,
        border: `1px solid ${isError ? T.red : isSuccess ? T.green : T.accent}35`,
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isError || isSuccess ? 22 : 20,
          color,
        }}
      >
        {STAGE_ICON[state.stage] ?? '⟳'}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color }}>
          {TERMINAL_STAGE_LABEL[state.stage]}
        </div>
        {state.error && (
          <div style={{ fontSize: 12, color: T.red, marginTop: 6, maxWidth: 220 }}>
            {state.error}
          </div>
        )}
        {!isError && !isSuccess && (
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>
            Stripe simulated reader
          </div>
        )}
      </div>
    </div>
  );
}
