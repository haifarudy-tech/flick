import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { T } from '@/tokens';
import { useFinishConnect } from '@/hooks/useDelivery';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { DeliveryPlatform } from '@flick/shared/types';

function apiKeyToEnum(key: string): DeliveryPlatform | null {
  switch (key) {
    case 'ubereats':
      return 'UBER_EATS';
    case 'deliveroo':
      return 'DELIVEROO';
    case 'justeat':
      return 'JUST_EAT';
    default:
      return null;
  }
}

export function DeliveryCallbackPage() {
  const { platform: apiKey } = useParams<{ platform: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const finish = useFinishConnect();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [externalLocationId, setExternalLocationId] = useState('');

  const code = search.get('code');
  const state = search.get('state');
  const platform = apiKey ? apiKeyToEnum(apiKey) : null;

  useEffect(() => {
    // The server's finishConnect expects an externalLocationId in the body.
    // We prompt once rather than run automatically so the user can paste their
    // store / restaurant ID from the platform dashboard. If they already gave
    // it in the URL (some platforms pass it through), use that directly.
    const fromUrl = search.get('location') ?? search.get('store_id');
    if (fromUrl) setExternalLocationId(fromUrl);
  }, [search]);

  const handleComplete = async () => {
    if (!code || !state || !platform || ran.current) return;
    if (!externalLocationId.trim()) {
      setError('Enter your store / location ID from the platform dashboard.');
      return;
    }
    ran.current = true;
    try {
      await finish.mutateAsync({
        platform,
        code,
        state,
        externalLocationId: externalLocationId.trim(),
      });
      toast.success('Platform connected');
      navigate('/delivery', { replace: true });
    } catch (err) {
      ran.current = false;
      setError(err instanceof ApiError ? err.message : 'Could not complete connection');
    }
  };

  if (!code || !state || !platform) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: T.text,
        }}
      >
        Missing OAuth parameters — return to <a href="/delivery" style={{ color: T.accent }}>Delivery</a>.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 24,
          maxWidth: 420,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
          Finish connection
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: T.textMid }}>
          Paste your {platform.replace('_', ' ').toLowerCase()} store / location
          ID to finish linking this account.
        </p>
        <input
          value={externalLocationId}
          onChange={(e) => setExternalLocationId(e.target.value)}
          placeholder="Store / location ID"
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: T.bg,
            border: `1px solid ${T.border}`,
            color: T.text,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleComplete();
          }}
        />
        {error && (
          <div style={{ fontSize: 12, color: T.red }}>{error}</div>
        )}
        <button
          type="button"
          onClick={handleComplete}
          disabled={finish.isPending}
          style={{
            padding: '12px',
            borderRadius: 10,
            background: T.accent,
            color: '#fff',
            border: 'none',
            fontSize: 14,
            fontWeight: 800,
            cursor: finish.isPending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: finish.isPending ? 0.6 : 1,
          }}
        >
          {finish.isPending ? 'Connecting…' : 'Complete connection'}
        </button>
      </div>
    </div>
  );
}
