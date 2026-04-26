import { useState } from 'react';
import { T, RADIUS } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { PLAN_LIMITS, planMeets } from '@flick/shared/types';
import type { Plan } from '@flick/shared/types';

const PLAN_PRICES: Record<Exclude<Plan, 'FREE'>, { monthly: number; label: string }> = {
  STARTER: { monthly: 29, label: 'Starter' },
  PRO: { monthly: 59, label: 'Pro' },
  ENTERPRISE: { monthly: 99, label: 'Enterprise' },
};

const PLAN_FEATURES: Record<Plan, string[]> = {
  FREE: ['POS & orders', '50 menu items', '1 location'],
  STARTER: ['Unlimited menu items', '1 delivery platform', 'QR ordering', '30-day analytics'],
  PRO: [
    'All delivery platforms',
    'Kitchen Display System',
    'Staff management',
    'Inventory tracking',
    'Loyalty programme',
    '365-day analytics',
    'CSV exports',
  ],
  ENTERPRISE: ['Unlimited locations', 'Everything in Pro', 'Dedicated support'],
};

export interface UpgradeModalProps {
  feature: string;
  description: string;
  required: Exclude<Plan, 'FREE'>;
  billingPeriod?: 'monthly' | 'annual';
  onClose: () => void;
}

export function UpgradeModal({
  feature,
  description,
  required,
  billingPeriod = 'monthly',
  onClose,
}: UpgradeModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const info = PLAN_PRICES[required];
  const monthly = info.monthly;
  const annual = Math.round(monthly * 0.8);
  const price = billingPeriod === 'annual' ? annual : monthly;

  const upgrade = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ url: string }>('/api/v1/subscription/checkout', {
        plan: required,
        billingPeriod,
      });
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start checkout.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: 32,
          maxWidth: 420,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Lock icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${T.accent}22, ${T.gold}22)`,
            border: `1px solid ${T.accent}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            marginBottom: 20,
          }}
        >
          🔒
        </div>

        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: T.textDim,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.3px' }}>
          {feature}
        </div>
        <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6, marginBottom: 20 }}>
          {description}
        </div>

        {/* Plan card */}
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.accent}40`,
            borderRadius: RADIUS.card,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}
          >
            <div>
              <span style={{ fontSize: 15, fontWeight: 900 }}>{info.label}</span>
              {required === 'PRO' && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${T.accent}, ${T.gold})`,
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  MOST POPULAR
                </span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: T.accent }}>£{price}</span>
              <span style={{ fontSize: 12, color: T.textMid }}>/{billingPeriod === 'annual' ? 'mo·annual' : 'mo'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PLAN_FEATURES[required].map((f) => (
              <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: T.textMid }}>
                <span style={{ color: T.green, fontSize: 10 }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button full onClick={() => void upgrade()} disabled={loading}>
            {loading ? 'Opening checkout…' : `Upgrade to ${info.label}`}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline lock overlay ────────────────────────────────────────────────────

export interface PlanLockOverlayProps {
  feature: string;
  description: string;
  required: Exclude<Plan, 'FREE'>;
}

export function PlanLockOverlay({ feature, description, required }: PlanLockOverlayProps) {
  const [showModal, setShowModal] = useState(false);
  const info = PLAN_PRICES[required];

  return (
    <>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 40,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${T.accent}15, ${T.gold}15)`,
            border: `1px solid ${T.accent}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          🔒
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.3px', marginBottom: 6 }}>
            {feature}
          </div>
          <div
            style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}
          >
            {description}
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: `${T.accent}12`,
            border: `1px solid ${T.accent}25`,
            fontSize: 12,
            color: T.textMid,
          }}
        >
          <span style={{ color: T.accent, fontWeight: 700 }}>Requires {info.label}</span>
          <span>·</span>
          <span>£{info.monthly}/mo</span>
        </div>
        <Button onClick={() => setShowModal(true)}>Upgrade to {info.label}</Button>
      </div>
      {showModal && (
        <UpgradeModal
          feature={feature}
          description={description}
          required={required}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// Re-export plan utilities for convenience
export { planMeets, PLAN_LIMITS };
