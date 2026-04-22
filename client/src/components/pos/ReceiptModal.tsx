import { useState } from 'react';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { fmt } from '@/lib/format';
import type { CartLine } from '@/stores/cart';

// Receipt modal shown after a successful order. Supports print / email / SMS /
// none. "Print" opens the browser print dialog with a receipt-shaped page;
// email and SMS are scaffolded to hit future endpoints and are not yet wired
// to the server.

export interface ReceiptInfo {
  orderNumber: number | string;
  businessName: string;
  total: number;
  subtotal: number;
  vat: number;
  discount: number;
  lines: CartLine[];
  paymentMethod: 'CARD' | 'CASH' | 'SPLIT';
  change?: number;
}

export function ReceiptModal({
  info,
  onClose,
}: {
  info: ReceiptInfo;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const printReceipt = () => {
    const w = window.open('', '_blank', 'width=340,height=600');
    if (!w) return;
    w.document.write(`
      <!doctype html><html><head><meta charset="utf-8"/><title>Receipt ${info.orderNumber}</title>
      <style>
        body{font-family:ui-monospace,monospace;max-width:300px;margin:20px auto;color:#111;}
        h1{font-size:16px;margin:0 0 8px;} .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0;}
        hr{border:none;border-top:1px dashed #999;margin:10px 0;}
        .total{font-size:14px;font-weight:800;}
      </style></head><body>
      <h1>${info.businessName}</h1>
      <div style="font-size:11px;color:#555;">Order ${info.orderNumber} · ${new Date().toLocaleString('en-GB')}</div>
      <hr/>
      ${info.lines
        .map(
          (l) =>
            `<div class="row"><span>${l.quantity}× ${l.name}</span><span>${fmt(l.unitPrice * l.quantity)}</span></div>`,
        )
        .join('')}
      <hr/>
      <div class="row"><span>Subtotal</span><span>${fmt(info.subtotal)}</span></div>
      ${info.discount > 0 ? `<div class="row"><span>Discount</span><span>−${fmt(info.discount)}</span></div>` : ''}
      <div class="row"><span>VAT</span><span>${fmt(info.vat)}</span></div>
      <div class="row total"><span>TOTAL</span><span>${fmt(info.total)}</span></div>
      <div class="row"><span>Paid</span><span>${info.paymentMethod}${
        info.paymentMethod === 'CASH' && info.change ? ` · change ${fmt(info.change)}` : ''
      }</span></div>
      <hr/>
      <div style="text-align:center;font-size:11px;color:#555;">Thank you 🧡</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const sendEmail = () => {
    // Placeholder — a future session wires /api/v1/receipts/email.
    setStatus(`Receipt will be emailed to ${email}.`);
  };
  const sendSms = () => {
    setStatus(`Receipt will be texted to ${phone}.`);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12,11,9,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: 14,
            marginBottom: 14,
            background: 'rgba(78,168,107,0.12)',
            border: `1px solid ${T.green}30`,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 28 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: T.green }}>Order fired</div>
          <div className="num" style={{ fontSize: 12, color: T.textMid }}>
            #{info.orderNumber} · {fmt(info.total)}
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            color: T.textDim,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: 8,
          }}
        >
          Send receipt
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button full onClick={printReceipt}>
            🖨 Print
          </Button>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                flex: 1,
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
            <Button variant="secondary" small onClick={sendEmail} disabled={!email}>
              Email
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="tel"
              placeholder="07… phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                flex: 1,
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
            <Button variant="secondary" small onClick={sendSms} disabled={!phone}>
              SMS
            </Button>
          </div>

          {status && (
            <div
              style={{
                background: T.accentGlow,
                color: T.accent,
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {status}
            </div>
          )}

          <Button variant="ghost" full onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
