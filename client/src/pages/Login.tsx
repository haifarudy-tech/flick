import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { AuthUser, AuthBusiness } from '@/stores/auth';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  business: AuthBusiness;
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: Location } | null)?.from?.pathname ?? '/pos';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>('/api/v1/auth/login', { email, password });
      setAuth({ accessToken: res.accessToken, user: res.user, business: res.business });
      nav(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Flick account"
      footer={
        <>
          New to Flick?{' '}
          <Link to="/signup" style={{ color: T.accent, fontWeight: 700, textDecoration: 'none' }}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@cafe.co.uk"
          />
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div
            style={{
              background: 'rgba(201,84,84,0.12)',
              border: `1px solid ${T.red}30`,
              color: T.red,
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}
        <Button full disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Link
            to="/pos-login"
            style={{ color: T.textMid, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            Staff quick login →
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

// Shared shell used by login / signup / pos-login for consistent framing.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
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
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 20,
              color: '#fff',
              boxShadow: `0 6px 20px ${T.accent}40`,
            }}
          >
            F
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>Flick</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: T.textMid }}>{subtitle}</p>
          )}
        </div>
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          {children}
        </div>
        {footer && (
          <div style={{ textAlign: 'center', fontSize: 13, color: T.textMid }}>{footer}</div>
        )}
      </div>
    </div>
  );
}
