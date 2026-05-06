import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { T, RADIUS, FONT } from '@/tokens';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ConfirmationOrder {
  id: string;
  orderNumber: number;
  type: string;
  status: string;
  tableNumber?: string;
  customerName?: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    modifiers: { modifierName: string; priceAdd: number }[];
  }[];
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
  createdAt: string;
}

function fmt(n: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

const TYPE_LABEL: Record<string, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
};

export function PublicMenuConfirmationPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [order, setOrder] = useState<ConfirmationOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;
    const url = new URL(`${API_URL}/api/v1/orders/public/${orderId}`);
    if (sessionId) url.searchParams.set('session_id', sessionId);

    fetch(url.toString())
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? 'Order not found');
        return data as ConfirmationOrder;
      })
      .then((o) => {
        setOrder(o);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load order');
        setLoading(false);
      });
  }, [orderId, sessionId]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: T.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT.body,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <p style={{ color: T.textMid, fontSize: 14 }}>Confirming your order…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: T.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT.body,
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
          <h2 style={{ color: T.text, fontSize: 20, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: T.textMid, fontSize: 14, marginBottom: 20 }}>
            {error || 'Order not found'}
          </p>
          <Link
            to={`/menu/${slug}`}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: T.accent,
              color: 'white',
              borderRadius: RADIUS.md,
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            ← Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        fontFamily: FONT.body,
        color: T.text,
        maxWidth: 520,
        margin: '0 auto',
        padding: '32px 20px 48px',
      }}
    >
      {/* Success header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(78,168,107,0.15)',
            border: `2px solid ${T.green}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            margin: '0 auto 16px',
          }}
        >
          ✓
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.text, margin: '0 0 6px' }}>
          Order Confirmed!
        </h1>
        <p style={{ fontSize: 14, color: T.textMid, margin: 0 }}>
          We'll let you know when it's ready
        </p>
      </div>

      {/* Order number card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.accent}22, ${T.accentDark}11)`,
          border: `1.5px solid ${T.accent}55`,
          borderRadius: RADIUS.card,
          padding: '20px 24px',
          marginBottom: 20,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Order Number
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: T.accent }}>
          #{order.orderNumber}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            background: 'rgba(78,168,107,0.12)',
            border: `1px solid rgba(78,168,107,0.3)`,
            borderRadius: RADIUS.pill,
            padding: '4px 12px',
          }}
        >
          <span style={{ fontSize: 8, color: T.green }}>●</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.green }}>
            {TYPE_LABEL[order.type] ?? order.type}
            {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
          </span>
        </div>
      </div>

      {/* Order items */}
      <div
        style={{
          background: T.card,
          borderRadius: RADIUS.card,
          padding: '16px',
          marginBottom: 16,
          border: `1px solid ${T.border}`,
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
          Your Items
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {order.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: T.text }}>
                  <span style={{ fontWeight: 600 }}>{item.quantity}×</span> {item.name}
                </div>
                {item.modifiers.length > 0 && (
                  <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>
                    {item.modifiers.map((m) => m.modifierName).join(', ')}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.accent, flexShrink: 0 }}>
                {fmt(item.totalPrice)}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            marginTop: 12,
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: T.textMid }}>Subtotal</span>
            <span style={{ fontSize: 13, color: T.textMid }}>{fmt(order.subtotal)}</span>
          </div>
          {order.vatAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: T.textMid }}>VAT</span>
              <span style={{ fontSize: 13, color: T.textMid }}>{fmt(order.vatAmount)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.accent }}>{fmt(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div
          style={{
            background: T.card,
            borderRadius: RADIUS.md,
            padding: '12px 16px',
            marginBottom: 16,
            border: `1px solid ${T.border}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 4 }}>
            Notes
          </div>
          <p style={{ fontSize: 13, color: T.text, margin: 0 }}>{order.notes}</p>
        </div>
      )}

      {/* Info banner */}
      <div
        style={{
          background: 'rgba(74,139,200,0.1)',
          border: `1px solid rgba(74,139,200,0.25)`,
          borderRadius: RADIUS.md,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
        <p style={{ fontSize: 13, color: T.blue, margin: 0, lineHeight: 1.5 }}>
          Your order has been received. We'll start preparing it shortly.
          Estimated time is 10–20 minutes depending on how busy we are.
        </p>
      </div>

      {/* Back to menu */}
      <Link
        to={`/menu/${slug}`}
        style={{
          display: 'block',
          width: '100%',
          padding: '13px',
          textAlign: 'center',
          background: T.card,
          border: `1.5px solid ${T.border}`,
          borderRadius: RADIUS.md,
          color: T.text,
          fontWeight: 700,
          textDecoration: 'none',
          fontSize: 14,
        }}
      >
        ← Back to Menu
      </Link>
    </div>
  );
}
