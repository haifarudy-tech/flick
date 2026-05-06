import { useRef, useState } from 'react';
import { T, RADIUS, FONT } from '@/tokens';
import { useAuthStore } from '@/stores/auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      style={{
        padding: '8px 14px',
        background: copied ? 'rgba(78,168,107,0.15)' : T.card,
        border: `1.5px solid ${copied ? T.green : T.border}`,
        borderRadius: RADIUS.sm,
        color: copied ? T.green : T.textMid,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: FONT.body,
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export function QRSettingsPage() {
  const { business } = useAuthStore();
  const slug = business?.slug ?? '';
  const frontendUrl = import.meta.env.VITE_FRONTEND_URL ?? window.location.origin;
  const menuUrl = `${frontendUrl}/menu/${slug}`;
  const qrImageUrl = `${API_URL}/api/v1/business/qr/${slug}`;

  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-qr-code.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 24px',
        fontFamily: FONT.body,
        color: T.text,
        maxWidth: 640,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.text, margin: '0 0 6px' }}>
          QR Code & Online Ordering
        </h1>
        <p style={{ fontSize: 14, color: T.textMid, margin: 0 }}>
          Print the QR code and place it on tables. Customers scan to view your menu
          and order directly — zero commission.
        </p>
      </div>

      {/* Menu URL */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: RADIUS.card,
          padding: '20px',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMid,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 10,
          }}
        >
          Your Public Menu URL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              flex: 1,
              padding: '10px 14px',
              background: T.surface,
              borderRadius: RADIUS.sm,
              border: `1px solid ${T.border}`,
              fontSize: 13,
              color: T.accent,
              fontFamily: FONT.mono,
              wordBreak: 'break-all',
            }}
          >
            {menuUrl}
          </div>
          <CopyButton text={menuUrl} />
        </div>
        <a
          href={menuUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 10,
            fontSize: 12,
            color: T.blue,
            textDecoration: 'none',
          }}
        >
          Preview menu ↗
        </a>
      </div>

      {/* QR Code */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: RADIUS.card,
          padding: '24px',
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMid,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 20,
            alignSelf: 'flex-start',
          }}
        >
          QR Code
        </div>

        {/* QR image */}
        <div
          style={{
            background: '#EDE8DF',
            borderRadius: RADIUS.card,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <img
            src={qrImageUrl}
            alt="QR code for menu"
            style={{ width: 200, height: 200, display: 'block' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              padding: '10px 20px',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
              border: 'none',
              borderRadius: RADIUS.md,
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: downloading ? 'not-allowed' : 'pointer',
              fontFamily: FONT.body,
              opacity: downloading ? 0.7 : 1,
            }}
          >
            {downloading ? 'Downloading…' : '⬇ Download PNG'}
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '10px 20px',
              background: T.surface,
              border: `1.5px solid ${T.border}`,
              borderRadius: RADIUS.md,
              color: T.text,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT.body,
            }}
          >
            🖨 Print Poster
          </button>
        </div>
      </div>

      {/* Print poster template (hidden on screen, shown on print) */}
      <div
        ref={printRef}
        className="print-poster"
        style={{ display: 'none' }}
      >
        <div style={{ textAlign: 'center', fontFamily: FONT.body }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{business?.name}</div>
          <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>Scan to Order</div>
          <div style={{ fontSize: 14, color: '#555', marginBottom: 20 }}>
            Order from your table — no app needed
          </div>
          <img src={qrImageUrl} alt="QR" style={{ width: 220, height: 220 }} />
          <div style={{ fontSize: 12, color: '#888', marginTop: 12 }}>{menuUrl}</div>
        </div>
      </div>

      {/* How it works */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: RADIUS.card,
          padding: '20px',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.text,
            marginBottom: 14,
          }}
        >
          How it works
        </div>
        {[
          { icon: '📱', text: 'Customer scans the QR code with their phone camera' },
          { icon: '🍽️', text: 'They browse your full menu and add items to their order' },
          { icon: '💳', text: 'They pay securely by card via Stripe' },
          { icon: '🔔', text: 'The order appears instantly in your Live Orders — zero commission' },
        ].map((step, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: i < 3 ? 12 : 0,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{step.icon}</span>
            <span style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>
              {step.text}
            </span>
          </div>
        ))}
      </div>

      {/* Print styles injected via style tag */}
      <style>{`
        @media print {
          body > *:not(.print-root) { display: none !important; }
          .print-poster { display: block !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
