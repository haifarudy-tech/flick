import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { T, RADIUS, FONT } from '@/tokens';
import {
  usePublicMenu,
  type PublicMenuItem,
  type PublicModifier,
  type PublicModifierGroup,
} from '@/hooks/usePublicMenu';
import { PLAN_LIMITS } from '../../../shared/types/index';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Cart types
// ---------------------------------------------------------------------------

interface CartItem {
  /** Stable key: menuItemId + sorted modifier ids */
  key: string;
  menuItemId: string;
  name: string;
  emoji?: string;
  unitPrice: number;
  quantity: number;
  modifiers: { modifierName: string; priceAdd: number }[];
}

function cartItemKey(
  menuItemId: string,
  modifiers: { modifierName: string }[],
) {
  return `${menuItemId}::${modifiers
    .map((m) => m.modifierName)
    .sort()
    .join('|')}`;
}

function fmt(n: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Modifier picker (inside item detail modal)
// ---------------------------------------------------------------------------

function ModifierGroupPicker({
  group,
  selected,
  onChange,
}: {
  group: PublicModifierGroup;
  selected: PublicModifier[];
  onChange: (mods: PublicModifier[]) => void;
}) {
  const toggleMod = (mod: PublicModifier) => {
    if (group.multiSelect) {
      const already = selected.find((s) => s.id === mod.id);
      if (already) {
        onChange(selected.filter((s) => s.id !== mod.id));
      } else {
        if (selected.length < group.maxSelect) onChange([...selected, mod]);
      }
    } else {
      onChange(selected[0]?.id === mod.id ? [] : [mod]);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
          {group.name}
        </span>
        {group.required && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.accent,
              background: 'rgba(224,122,74,0.15)',
              padding: '2px 7px',
              borderRadius: RADIUS.pill,
            }}
          >
            Required
          </span>
        )}
        {group.multiSelect && (
          <span style={{ fontSize: 11, color: T.textMid }}>
            (up to {group.maxSelect})
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {group.modifiers.map((mod) => {
          const isSelected = !!selected.find((s) => s.id === mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => toggleMod(mod)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isSelected
                  ? 'rgba(224,122,74,0.12)'
                  : T.surface,
                border: `1.5px solid ${isSelected ? T.accent : T.border}`,
                borderRadius: RADIUS.sm,
                padding: '10px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: group.multiSelect ? RADIUS.sm : '50%',
                    border: `2px solid ${isSelected ? T.accent : T.textDim}`,
                    background: isSelected ? T.accent : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSelected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 14, color: T.text }}>{mod.name}</span>
              </div>
              {mod.priceAdd > 0 && (
                <span style={{ fontSize: 13, color: T.textMid }}>
                  +{fmt(mod.priceAdd)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item detail modal
// ---------------------------------------------------------------------------

function ItemDetailModal({
  item,
  currency,
  onClose,
  onAddToCart,
}: {
  item: PublicMenuItem;
  currency: string;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selectedMods, setSelectedMods] = useState<
    Record<string, PublicModifier[]>
  >({});

  const modTotal = Object.values(selectedMods)
    .flat()
    .reduce((s, m) => s + Number(m.priceAdd), 0);
  const unitPrice = Number(item.basePrice) + modTotal;
  const lineTotal = unitPrice * qty;

  const allRequiredMet = item.modifierGroups
    .filter((g) => g.required)
    .every((g) => (selectedMods[g.id]?.length ?? 0) > 0);

  const handleAdd = () => {
    if (!allRequiredMet) return;
    const mods = Object.values(selectedMods)
      .flat()
      .map((m) => ({ modifierName: m.name, priceAdd: Number(m.priceAdd) }));
    const key = cartItemKey(item.id, mods);
    onAddToCart({
      key,
      menuItemId: item.id,
      name: item.name,
      emoji: item.emoji,
      unitPrice,
      quantity: qty,
      modifiers: mods,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.card,
          borderRadius: `${RADIUS.card} ${RADIUS.card} 0 0`,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px 20px',
          fontFamily: FONT.body,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>
              {item.emoji || '🍽️'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>
              {item.name}
            </div>
            {item.isPopular && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.gold,
                  background: 'rgba(200,153,58,0.15)',
                  padding: '2px 8px',
                  borderRadius: RADIUS.pill,
                  marginTop: 4,
                }}
              >
                ★ Popular
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: '50%',
              width: 32,
              height: 32,
              color: T.textMid,
              cursor: 'pointer',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {item.description && (
          <p style={{ fontSize: 14, color: T.textMid, marginBottom: 20, lineHeight: 1.5 }}>
            {item.description}
          </p>
        )}

        {/* Modifier groups */}
        {item.modifierGroups.map((group) => (
          <ModifierGroupPicker
            key={group.id}
            group={group}
            selected={selectedMods[group.id] ?? []}
            onChange={(mods) =>
              setSelectedMods((prev) => ({ ...prev, [group.id]: mods }))
            }
          />
        ))}

        {/* Quantity */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: T.surface,
            borderRadius: RADIUS.md,
            padding: '10px 16px',
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 14, color: T.textMid }}>Quantity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: qty <= 1 ? T.border : T.accent,
                border: 'none',
                color: qty <= 1 ? T.textDim : 'white',
                fontSize: 18,
                cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                fontWeight: 700,
              }}
            >
              −
            </button>
            <span style={{ fontSize: 18, fontWeight: 700, color: T.text, minWidth: 24, textAlign: 'center' }}>
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: T.accent,
                border: 'none',
                color: 'white',
                fontSize: 18,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Add to order button */}
        <button
          onClick={handleAdd}
          disabled={!allRequiredMet}
          style={{
            width: '100%',
            padding: '14px',
            background: allRequiredMet
              ? `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`
              : T.border,
            border: 'none',
            borderRadius: RADIUS.md,
            color: allRequiredMet ? 'white' : T.textDim,
            fontSize: 15,
            fontWeight: 700,
            cursor: allRequiredMet ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: FONT.body,
          }}
        >
          <span>Add to order</span>
          <span>{fmt(lineTotal, currency)}</span>
        </button>

        {!allRequiredMet && (
          <p style={{ fontSize: 12, color: T.gold, textAlign: 'center', marginTop: 8 }}>
            Please make all required selections above
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkout sheet
// ---------------------------------------------------------------------------

type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
type CheckoutStep = 'cart' | 'details' | 'confirming';

interface CheckoutState {
  type: OrderType;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  notes: string;
}

function CheckoutSheet({
  cart,
  currency,
  slug,
  onClose,
  onUpdateQty,
  onRemove,
}: {
  cart: CartItem[];
  currency: string;
  slug: string;
  onClose: () => void;
  onUpdateQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [form, setForm] = useState<CheckoutState>({
    type: 'DINE_IN',
    tableNumber: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deliveryAddress: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const handleProceedToDetails = () => {
    if (cart.length === 0) return;
    setStep('details');
  };

  const handlePay = async () => {
    setError('');
    if (!form.customerName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (form.type === 'DINE_IN' && !form.tableNumber.trim()) {
      setError('Please enter your table number.');
      return;
    }
    if (form.type === 'DELIVERY' && !form.deliveryAddress.trim()) {
      setError('Please enter your delivery address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/public/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          type: form.type,
          tableNumber: form.tableNumber || undefined,
          customerName: form.customerName,
          customerPhone: form.customerPhone || undefined,
          customerEmail: form.customerEmail || undefined,
          deliveryAddress: form.deliveryAddress || undefined,
          notes: form.notes || undefined,
          items: cart.map((ci) => ({
            menuItemId: ci.menuItemId,
            name: ci.name,
            quantity: ci.quantity,
            unitPrice: Number(ci.unitPrice) - ci.modifiers.reduce((s, m) => s + m.priceAdd, 0),
            modifiers: ci.modifiers,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Failed to create order');
      }
      // Redirect to Stripe hosted Checkout
      window.location.href = data.checkoutUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const typeLabels: Record<OrderType, string> = {
    DINE_IN: '🪑 Dine In',
    TAKEAWAY: '🥡 Takeaway',
    DELIVERY: '🛵 Delivery',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: `${RADIUS.card} ${RADIUS.card} 0 0`,
          width: '100%',
          maxWidth: 520,
          maxHeight: '92vh',
          overflowY: 'auto',
          fontFamily: FONT.body,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 20px 16px',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step !== 'cart' && (
              <button
                onClick={() => setStep(step === 'details' ? 'cart' : 'details')}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: RADIUS.sm,
                  padding: '4px 10px',
                  color: T.textMid,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                ← Back
              </button>
            )}
            <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}>
              {step === 'cart' ? 'Your Order' : step === 'details' ? 'Order Details' : 'Processing…'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: T.textMid,
              fontSize: 22,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px 20px 24px' }}>
          {step === 'cart' && (
            <>
              {/* Cart items */}
              {cart.length === 0 ? (
                <p style={{ color: T.textMid, textAlign: 'center', padding: '32px 0' }}>
                  Your cart is empty
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    {cart.map((ci) => (
                      <div
                        key={ci.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          background: T.card,
                          borderRadius: RADIUS.md,
                          padding: '12px 14px',
                        }}
                      >
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{ci.emoji || '🍽️'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                            {ci.name}
                          </div>
                          {ci.modifiers.length > 0 && (
                            <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>
                              {ci.modifiers.map((m) => m.modifierName).join(', ')}
                            </div>
                          )}
                          <div style={{ fontSize: 13, color: T.accent, marginTop: 4, fontWeight: 600 }}>
                            {fmt(ci.unitPrice * ci.quantity, currency)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => onUpdateQty(ci.key, -1)}
                            style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: T.border, border: 'none',
                              color: T.text, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                            }}
                          >−</button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.text, minWidth: 16, textAlign: 'center' }}>
                            {ci.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQty(ci.key, 1)}
                            style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: T.accent, border: 'none',
                              color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                            }}
                          >+</button>
                          <button
                            onClick={() => onRemove(ci.key)}
                            style={{
                              background: 'none', border: 'none',
                              color: T.red, cursor: 'pointer', fontSize: 16,
                              marginLeft: 4,
                            }}
                          >×</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subtotal */}
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '12px 0', borderTop: `1px solid ${T.border}`,
                      marginBottom: 16,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Subtotal</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>
                      {fmt(subtotal, currency)}
                    </span>
                  </div>

                  <button
                    onClick={handleProceedToDetails}
                    style={{
                      width: '100%', padding: '14px',
                      background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
                      border: 'none', borderRadius: RADIUS.md,
                      color: 'white', fontSize: 15, fontWeight: 700,
                      cursor: 'pointer', fontFamily: FONT.body,
                    }}
                  >
                    Continue →
                  </button>
                </>
              )}
            </>
          )}

          {step === 'details' && (
            <>
              {/* Order type */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                  Order Type
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as OrderType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      style={{
                        flex: 1, padding: '10px 6px',
                        background: form.type === t ? 'rgba(224,122,74,0.15)' : T.card,
                        border: `1.5px solid ${form.type === t ? T.accent : T.border}`,
                        borderRadius: RADIUS.sm,
                        color: form.type === t ? T.accent : T.textMid,
                        fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT.body,
                        transition: 'all 0.15s',
                      }}
                    >
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional fields */}
              {form.type === 'DINE_IN' && (
                <Field label="Table Number *" value={form.tableNumber}
                  onChange={(v) => setForm((f) => ({ ...f, tableNumber: v }))}
                  placeholder="e.g. 5" />
              )}
              {form.type === 'DELIVERY' && (
                <Field label="Delivery Address *" value={form.deliveryAddress}
                  onChange={(v) => setForm((f) => ({ ...f, deliveryAddress: v }))}
                  placeholder="Full address incl. postcode" multiline />
              )}

              <Field label="Your Name *" value={form.customerName}
                onChange={(v) => setForm((f) => ({ ...f, customerName: v }))}
                placeholder="First name or full name" />
              <Field label="Phone" value={form.customerPhone}
                onChange={(v) => setForm((f) => ({ ...f, customerPhone: v }))}
                placeholder="Optional — for updates" type="tel" />
              <Field label="Email" value={form.customerEmail}
                onChange={(v) => setForm((f) => ({ ...f, customerEmail: v }))}
                placeholder="Optional — for receipt" type="email" />
              <Field label="Order Notes" value={form.notes}
                onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Allergies, special requests…" multiline />

              {error && (
                <div style={{
                  background: 'rgba(201,84,84,0.12)', border: `1px solid ${T.red}`,
                  borderRadius: RADIUS.sm, padding: '10px 14px',
                  color: T.red, fontSize: 13, marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              {/* Summary + Pay */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 0', borderTop: `1px solid ${T.border}`, marginBottom: 16,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>
                  {fmt(subtotal, currency)}
                </span>
              </div>

              <button
                onClick={handlePay}
                disabled={loading}
                style={{
                  width: '100%', padding: '14px',
                  background: loading ? T.border : `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
                  border: 'none', borderRadius: RADIUS.md,
                  color: loading ? T.textDim : 'white',
                  fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: FONT.body,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <Spinner /> Taking you to payment…
                  </>
                ) : (
                  <>🔒 Pay {fmt(subtotal, currency)}</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text', multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean;
}) {
  const sharedStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box' as const,
    background: T.card, border: `1.5px solid ${T.border}`, borderRadius: RADIUS.sm,
    color: T.text, fontSize: 14, fontFamily: FONT.body,
    outline: 'none', resize: 'none' as const,
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={sharedStyle}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={sharedStyle}
        />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 16, height: 16, border: `2px solid rgba(255,255,255,0.3)`,
        borderTop: `2px solid white`, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main PublicMenu page
// ---------------------------------------------------------------------------

export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = usePublicMenu(slug ?? '');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const headerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const currency = data?.business.currency ?? 'GBP';

  // Plan feature check
  const canOrder =
    data?.business.plan ? PLAN_LIMITS[data.business.plan as keyof typeof PLAN_LIMITS]?.qrOrdering ?? false : false;

  // Cart helpers
  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.key === item.key);
      if (existing) {
        return prev.map((c) =>
          c.key === item.key ? { ...c, quantity: c.quantity + item.quantity } : c,
        );
      }
      return [...prev, item];
    });
  }, []);

  const updateQty = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase();
    return data.items.filter(
      (item) =>
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q),
    );
  }, [data, searchQuery]);

  // Group by category
  const itemsByCategory = useMemo(() => {
    if (!data) return new Map<string, typeof filteredItems>();
    const map = new Map<string, typeof filteredItems>();
    for (const cat of data.categories) {
      const items = filteredItems.filter((i) => i.categoryId === cat.id);
      if (items.length > 0) map.set(cat.id, items);
    }
    const uncategorised = filteredItems.filter((i) => !i.categoryId);
    if (uncategorised.length > 0) map.set('__uncategorised__', uncategorised);
    return map;
  }, [data, filteredItems]);

  // Sticky category tab scroll tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategoryId(entry.target.getAttribute('data-category-id'));
          }
        }
      },
      { threshold: 0.3, rootMargin: '-80px 0px -60% 0px' },
    );
    Object.values(categoryRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [itemsByCategory]);

  const scrollToCategory = (catId: string) => {
    const el = categoryRefs.current[catId];
    if (!el) return;
    const offset = (tabsRef.current?.offsetHeight ?? 0) + (headerRef.current?.offsetHeight ?? 0);
    const top = el.getBoundingClientRect().top + window.scrollY - offset - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: FONT.body,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🍽️</div>
          <p style={{ color: T.textMid, fontSize: 14 }}>Loading menu…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: FONT.body, padding: 24,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
          <h2 style={{ color: T.text, fontSize: 20, marginBottom: 8 }}>Menu not found</h2>
          <p style={{ color: T.textMid, fontSize: 14 }}>This menu link may be incorrect or unavailable.</p>
        </div>
      </div>
    );
  }

  const { business, categories } = data;
  const visibleCategoryIds = Array.from(itemsByCategory.keys());

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        fontFamily: FONT.body,
        color: T.text,
        maxWidth: 520,
        margin: '0 auto',
        position: 'relative',
        paddingBottom: cartCount > 0 ? 100 : 40,
      }}
    >
      {/* ---- Hero ---- */}
      <div
        ref={headerRef}
        style={{
          background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`,
          padding: '28px 20px 20px',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: RADIUS.card,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
              boxShadow: `0 4px 16px rgba(224,122,74,0.3)`,
            }}
          >
            {business.logo ? (
              <img
                src={business.logo}
                alt={business.name}
                style={{ width: '100%', height: '100%', borderRadius: RADIUS.card, objectFit: 'cover' }}
              />
            ) : (
              '🏠'
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.text, margin: '0 0 4px' }}>
              {business.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.green,
                  background: 'rgba(78,168,107,0.15)',
                  padding: '3px 10px',
                  borderRadius: RADIUS.pill,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 8 }}>●</span> Open now
              </span>
              {business.address && (
                <span style={{ fontSize: 12, color: T.textMid }}>
                  📍 {business.address}
                  {business.city ? `, ${business.city}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginTop: 16 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 15,
              color: T.textDim,
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '11px 14px 11px 38px',
              background: T.card,
              border: `1.5px solid ${T.border}`,
              borderRadius: RADIUS.md,
              color: T.text,
              fontSize: 14,
              fontFamily: FONT.body,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* FREE plan banner */}
      {!canOrder && (
        <div
          style={{
            background: 'rgba(200,153,58,0.12)',
            border: `1px solid rgba(200,153,58,0.3)`,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>🔒</span>
          <span style={{ fontSize: 13, color: T.gold }}>
            Online ordering not available — browse the menu below.
          </span>
        </div>
      )}

      {/* ---- Category tabs (sticky) ---- */}
      {visibleCategoryIds.length > 1 && (
        <div
          ref={tabsRef}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: T.bg,
            borderBottom: `1px solid ${T.border}`,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '10px 16px',
              whiteSpace: 'nowrap',
            }}
          >
            {visibleCategoryIds.map((catId) => {
              const cat = catId === '__uncategorised__'
                ? { name: 'Other' }
                : categories.find((c) => c.id === catId);
              const isActive = activeCategoryId === catId;
              return (
                <button
                  key={catId}
                  onClick={() => scrollToCategory(catId)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: RADIUS.pill,
                    border: `1.5px solid ${isActive ? T.accent : T.border}`,
                    background: isActive ? 'rgba(224,122,74,0.15)' : 'transparent',
                    color: isActive ? T.accent : T.textMid,
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    fontFamily: FONT.body,
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  {cat?.name ?? 'Other'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Menu items ---- */}
      <div style={{ padding: '8px 16px' }}>
        {itemsByCategory.size === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMid }}>
            {searchQuery ? `No items match "${searchQuery}"` : 'No items available'}
          </div>
        )}

        {visibleCategoryIds.map((catId) => {
          const catItems = itemsByCategory.get(catId) ?? [];
          const cat = catId === '__uncategorised__'
            ? { id: catId, name: 'Other' }
            : categories.find((c) => c.id === catId);

          return (
            <div
              key={catId}
              ref={(el) => { categoryRefs.current[catId] = el; }}
              data-category-id={catId}
              style={{ marginBottom: 8 }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: T.text,
                  padding: '16px 0 10px',
                  margin: 0,
                  borderBottom: `1px solid ${T.border}`,
                  marginBottom: 8,
                }}
              >
                {cat?.name ?? 'Other'}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {catItems.map((item) => {
                  const inCartQty = cart
                    .filter((c) => c.menuItemId === item.id)
                    .reduce((s, c) => s + c.quantity, 0);

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${T.border}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        fontFamily: FONT.body,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = T.card)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      {/* Emoji / image */}
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: RADIUS.md,
                          background: T.card,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 28,
                          flexShrink: 0,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          item.emoji || '🍽️'
                        )}
                        {inCartQty > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: T.accent,
                              color: 'white',
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {inCartQty}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                            {item.name}
                          </span>
                          {item.isPopular && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: T.gold,
                                background: 'rgba(200,153,58,0.15)',
                                padding: '1px 6px',
                                borderRadius: RADIUS.pill,
                              }}
                            >
                              ★
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p
                            style={{
                              fontSize: 12,
                              color: T.textMid,
                              margin: '0 0 4px',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.4,
                            }}
                          >
                            {item.description}
                          </p>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>
                          {fmt(Number(item.basePrice), currency)}
                        </span>
                      </div>

                      {/* Add button */}
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 20,
                          fontWeight: 700,
                          flexShrink: 0,
                          boxShadow: `0 2px 8px rgba(224,122,74,0.3)`,
                        }}
                      >
                        +
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Floating cart button ---- */}
      {canOrder && cartCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            width: 'calc(100% - 40px)',
            maxWidth: 460,
          }}
        >
          <button
            onClick={() => setShowCart(true)}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
              border: 'none',
              borderRadius: RADIUS.md,
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: FONT.body,
              boxShadow: `0 8px 24px rgba(224,122,74,0.45)`,
            }}
          >
            <span
              style={{
                background: 'rgba(255,255,255,0.25)',
                borderRadius: RADIUS.sm,
                padding: '2px 9px',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {cartCount}
            </span>
            <span>View Order</span>
            <span>{fmt(cartTotal, currency)}</span>
          </button>
        </div>
      )}

      {/* ---- Item detail modal ---- */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          currency={currency}
          onClose={() => setSelectedItem(null)}
          onAddToCart={(ci) => {
            if (canOrder) addToCart(ci);
            setSelectedItem(null);
          }}
        />
      )}

      {/* ---- Checkout sheet ---- */}
      {showCart && (
        <CheckoutSheet
          cart={cart}
          currency={currency}
          slug={slug ?? ''}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
        />
      )}

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
