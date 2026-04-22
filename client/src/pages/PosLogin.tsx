import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { AuthUser, AuthBusiness } from '@/stores/auth';

interface PinLoginResponse {
  accessToken: string;
  user: AuthUser;
}

// POS quick-login screen. Staff scan a QR code on any device to land here,
// then tap their 4-digit PIN. Session lasts 1h (enforced server-side).
export function PosLoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const business = useAuthStore((s) => s.business);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  // If we're not logged in at the business level, we don't know which tenant
  // to authenticate against. Redirect to a manual route where the business
  // slug is entered manually — for now, just prompt for one via URL hash.
  // Owners who are already signed in arrive here with a valid business slug.
  const businessSlug =
    business?.slug ?? new URLSearchParams(window.location.search).get('b') ?? '';

  const tap = (digit: string) => {
    setError(null);
    setPin((p) => (p.length >= 4 ? p : p + digit));
  };
  const backspace = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  };
  const clear = () => {
    setError(null);
    setPin('');
  };

  // Auto-submit once we have 4 digits.
  useEffect(() => {
    if (pin.length !== 4) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!businessSlug) {
          setError('Ask your manager for the workspace link.');
          return;
        }
        const res = await api.post<PinLoginResponse>('/api/v1/auth/pin-login', {
          businessSlug,
          pin,
        });
        if (cancelled) return;
        // PIN login doesn't include business details — reuse what we already
        // know or set a minimal stub.
        const biz =
          business ?? ({ id: '', name: '', slug: businessSlug, plan: 'FREE' } as AuthBusiness);
        setAuth({ accessToken: res.accessToken, user: res.user, business: biz });
        nav('/pos', { replace: true });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Wrong PIN. Try again.');
        setPin('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pin, businessSlug, business, setAuth, nav]);

  const qrUrl = `${window.location.origin}/pos-login?b=${businessSlug}`;
  // Lightweight public QR generator — no external JS dependency, renders SVG.
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&bgcolor=161410&color=EDE8DF&data=${encodeURIComponent(qrUrl)}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: 24,
        }}
      >
        {/* QR side */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            borderRight: `1px solid ${T.border}`,
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.textDim,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            Staff sign-in
          </div>
          <div
            style={{
              background: T.surface,
              borderRadius: 16,
              padding: 12,
              border: `1px solid ${T.border}`,
            }}
          >
            {businessSlug ? (
              <img src={qrImg} alt="Staff sign-in QR" width={200} height={200} />
            ) : (
              <div
                style={{
                  width: 200,
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: T.textDim,
                  fontSize: 12,
                  padding: 20,
                  textAlign: 'center',
                }}
              >
                Sign in once as the owner to generate your QR.
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.textMid, textAlign: 'center', lineHeight: 1.5 }}>
            Scan on any device to open this screen.
            <br />
            Then enter your 4-digit PIN.
          </div>
        </div>

        {/* PIN pad side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                color: T.textDim,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              Enter PIN
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 8,
                justifyContent: 'center',
              }}
            >
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length;
                return (
                  <div
                    key={i}
                    className="num"
                    style={{
                      width: 44,
                      height: 54,
                      borderRadius: 12,
                      border: `1px solid ${filled ? T.accent : T.border}`,
                      background: filled ? T.accentGlow : T.surface,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 900,
                      color: filled ? T.accent : T.textDim,
                    }}
                  >
                    {filled ? '•' : ''}
                  </div>
                );
              })}
            </div>
            {error && (
              <div
                style={{
                  marginTop: 10,
                  textAlign: 'center',
                  color: T.red,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                className="num"
                onClick={() => tap(d)}
                disabled={loading}
                style={{
                  padding: '14px 0',
                  borderRadius: 12,
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  color: T.text,
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={clear}
              disabled={loading}
              style={{
                padding: '14px 0',
                borderRadius: 12,
                background: 'transparent',
                border: `1px solid ${T.border}`,
                color: T.textMid,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="num"
              onClick={() => tap('0')}
              disabled={loading}
              style={{
                padding: '14px 0',
                borderRadius: 12,
                background: T.surface,
                border: `1px solid ${T.border}`,
                color: T.text,
                fontSize: 20,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              disabled={loading}
              style={{
                padding: '14px 0',
                borderRadius: 12,
                background: 'transparent',
                border: `1px solid ${T.border}`,
                color: T.textMid,
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⌫
            </button>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <Link
              to="/login"
              style={{
                color: T.textMid,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'block',
                textAlign: 'center',
              }}
            >
              ← Manager sign-in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
