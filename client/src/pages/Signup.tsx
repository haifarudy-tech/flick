import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { AuthUser, AuthBusiness } from '@/stores/auth';
import type { Plan } from '@flick/shared/types';

interface SignupResponse {
  accessToken: string;
  user: AuthUser;
  business: AuthBusiness;
}

const PLANS: Array<{ key: Plan; name: string; price: string; blurb: string }> = [
  { key: 'FREE', name: 'Free', price: '£0', blurb: '1 location · 50 items · basic POS' },
  { key: 'STARTER', name: 'Starter', price: '£29/mo', blurb: 'Unlimited menu · 1 delivery platform' },
  { key: 'PRO', name: 'Pro', price: '£59/mo', blurb: 'All platforms · kitchen · staff · inventory' },
];

export function SignupPage() {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<Plan>('FREE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<SignupResponse>('/api/v1/auth/signup', {
        businessName,
        email,
        password,
        plan,
      });
      setAuth({ accessToken: res.accessToken, user: res.user, business: res.business });
      nav('/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // Re-export AuthShell inline to avoid circular imports — it's the same shell.
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
          maxWidth: 440,
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
            Create your account
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: T.textMid }}>
            All the POS and delivery you need. Upgrade any time.
          </p>
        </div>

        <form
          onSubmit={submit}
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <Label>Business name</Label>
            <Input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Sunrise Cafe"
            />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <Label>Plan</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLANS.map((p) => {
                const active = plan === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlan(p.key)}
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: active ? T.accentGlow : 'transparent',
                      border: `1px solid ${active ? `${T.accent}55` : T.border}`,
                      color: T.text,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{p.blurb}</div>
                    </div>
                    <div
                      className="num"
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: active ? T.accent : T.textMid,
                      }}
                    >
                      {p.price}
                    </div>
                  </button>
                );
              })}
            </div>
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
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
          <p style={{ fontSize: 11, color: T.textDim, textAlign: 'center', margin: 0 }}>
            By signing up you agree to our Terms and Privacy Policy.
          </p>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: T.textMid }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: T.accent, fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
