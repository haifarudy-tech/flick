import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { T, RADIUS } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { planMeets, PLAN_LIMITS } from '@flick/shared/types';
import type { Plan } from '@flick/shared/types';
import { UpgradeModal } from '@/components/UpgradeModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageStats {
  menuItems: number;
  locations: number;
  deliveryPlatforms: number;
}

interface SubscriptionData {
  subscription: {
    plan: Plan;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
}

// ─── Plan definitions ─────────────────────────────────────────────────────────

type PaidPlan = Exclude<Plan, 'FREE'>;

interface PlanDef {
  key: Plan;
  name: string;
  monthly: number;
  color: string;
  features: string[];
  popular?: boolean;
}

const PLANS: PlanDef[] = [
  {
    key: 'FREE',
    name: 'Free',
    monthly: 0,
    color: T.textMid,
    features: [
      '1 location',
      '50 menu items',
      'POS & order management',
      '1-day analytics',
    ],
  },
  {
    key: 'STARTER',
    name: 'Starter',
    monthly: 29,
    color: T.blue,
    features: [
      '1 location',
      'Unlimited menu items',
      '1 delivery platform',
      'QR ordering',
      '30-day analytics',
    ],
  },
  {
    key: 'PRO',
    name: 'Pro',
    monthly: 59,
    color: T.accent,
    popular: true,
    features: [
      '1 location',
      'All 3 delivery platforms',
      'Kitchen Display System',
      'Staff management & timesheets',
      'Inventory tracking',
      'Loyalty programme',
      'Analytics CSV export',
      '365-day analytics',
    ],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    monthly: 99,
    color: T.gold,
    features: [
      'Unlimited locations',
      'Everything in Pro',
      'Multi-location analytics',
      'Dedicated onboarding',
      'Priority support',
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function usagePct(used: number, max: number) {
  if (max === Infinity) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function usageColor(pct: number) {
  if (pct >= 90) return T.red;
  if (pct >= 75) return T.gold;
  return T.green;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = usagePct(used, max);
  const color = usageColor(pct);
  const isUnlimited = max === Infinity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: T.textMid }}>{label}</span>
        <span style={{ color: T.text, fontWeight: 700 }}>
          {used}
          {isUnlimited ? '' : ` / ${max}`}
          {isUnlimited && <span style={{ color: T.textDim }}> (unlimited)</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div
          style={{
            height: 5,
            borderRadius: 10,
            background: T.border,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: color,
              borderRadius: 10,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SettingsBillingPage() {
  const toast = useToast();
  const currentPlan = useAuthStore((s) => s.business?.plan ?? 'FREE');
  const userRole = useAuthStore((s) => s.user?.role);
  const isOwner = userRole === 'OWNER';

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [upgradeTarget, setUpgradeTarget] = useState<PaidPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: usageData } = useQuery<UsageStats>({
    queryKey: ['subscription-usage'],
    queryFn: () => api.get('/api/v1/subscription/usage'),
  });

  const { data: subData } = useQuery<SubscriptionData>({
    queryKey: ['subscription'],
    queryFn: () => api.get('/api/v1/subscription'),
  });

  const sub = subData?.subscription;
  const limits = PLAN_LIMITS[currentPlan];

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await api.post<{ url: string }>('/api/v1/subscription/portal');
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not open billing portal.');
      setPortalLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 32, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Billing & Plans</div>
        <div style={{ fontSize: 13, color: T.textMid, marginTop: 4 }}>
          Manage your subscription and usage.
        </div>
      </div>

      {/* Current plan status bar */}
      {sub && (
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: RADIUS.card,
            padding: '14px 20px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: sub.status === 'ACTIVE' ? T.green : sub.status === 'PAST_DUE' ? T.gold : T.red,
                flexShrink: 0,
              }}
            />
            <div>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{currentPlan} plan</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: T.textMid }}>
                {sub.status === 'ACTIVE'
                  ? sub.cancelAtPeriodEnd
                    ? `Cancels ${fmtDate(sub.currentPeriodEnd)}`
                    : `Renews ${fmtDate(sub.currentPeriodEnd)}`
                  : sub.status === 'PAST_DUE'
                  ? 'Payment overdue'
                  : sub.status}
              </span>
            </div>
          </div>
          {isOwner && (
            <Button variant="secondary" small onClick={() => void openPortal()} disabled={portalLoading}>
              {portalLoading ? 'Opening…' : '⚙ Manage billing'}
            </Button>
          )}
        </div>
      )}

      {/* Billing period toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          justifyContent: 'flex-end',
        }}
      >
        <span style={{ fontSize: 12, color: T.textMid }}>Monthly</span>
        <button
          onClick={() => setBillingPeriod((p) => (p === 'monthly' ? 'annual' : 'monthly'))}
          style={{
            width: 46,
            height: 26,
            borderRadius: 13,
            background: billingPeriod === 'annual' ? T.accent : T.border,
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 3,
              left: billingPeriod === 'annual' ? 23 : 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          />
        </button>
        <span style={{ fontSize: 12, color: billingPeriod === 'annual' ? T.text : T.textMid }}>
          Annual
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              fontWeight: 700,
              color: T.green,
              background: `${T.green}15`,
              border: `1px solid ${T.green}30`,
              padding: '1px 6px',
              borderRadius: 10,
            }}
          >
            20% off
          </span>
        </span>
      </div>

      {/* Plan cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 32,
        }}
      >
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          // isDowngrade = current plan is already above the target (e.g. PRO → STARTER)
          const isDowngrade =
            plan.key !== 'FREE' && !isCurrent && planMeets(currentPlan, plan.key as Plan);
          const displayedMonthly =
            billingPeriod === 'annual' && plan.monthly > 0
              ? Math.round(plan.monthly * 0.8)
              : plan.monthly;

          return (
            <div
              key={plan.key}
              style={{
                background: isCurrent ? `${plan.color}08` : T.card,
                border: `1px solid ${isCurrent ? `${plan.color}50` : T.border}`,
                borderRadius: RADIUS.card,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                position: 'relative',
              }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -11,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: `linear-gradient(135deg, ${T.accent}, ${T.gold})`,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    padding: '3px 12px',
                    borderRadius: 20,
                    whiteSpace: 'nowrap',
                  }}
                >
                  MOST POPULAR
                </div>
              )}

              {/* Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: plan.color }}>{plan.name}</span>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: plan.color,
                        background: `${plan.color}15`,
                        border: `1px solid ${plan.color}30`,
                        padding: '2px 8px',
                        borderRadius: 10,
                        letterSpacing: '0.3px',
                      }}
                    >
                      CURRENT
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 24, fontWeight: 900 }}>
                    £{displayedMonthly}
                  </span>
                  <span style={{ fontSize: 11, color: T.textMid }}>
                    {plan.monthly === 0
                      ? ''
                      : billingPeriod === 'annual'
                      ? '/mo · billed annually'
                      : '/mo'}
                  </span>
                </div>
                {billingPeriod === 'annual' && plan.monthly > 0 && (
                  <div style={{ fontSize: 11, color: T.green, marginTop: 2 }}>
                    Save £{(plan.monthly - displayedMonthly) * 12}/yr
                  </div>
                )}
              </div>

              {/* Features */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: T.textMid }}>
                    <span style={{ color: plan.color, fontSize: 10, marginTop: 1 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isOwner && !isCurrent && plan.key !== 'FREE' && (
                <Button
                  variant={plan.popular ? 'primary' : 'secondary'}
                  small
                  full
                  onClick={() => setUpgradeTarget(plan.key as PaidPlan)}
                >
                  {isDowngrade ? 'Switch' : 'Upgrade'}
                </Button>
              )}
              {isOwner && isCurrent && plan.key !== 'FREE' && sub && (
                <Button variant="ghost" small full onClick={() => void openPortal()} disabled={portalLoading}>
                  {portalLoading ? 'Opening…' : 'Manage'}
                </Button>
              )}
              {!isOwner && !isCurrent && plan.key !== 'FREE' && (
                <div style={{ fontSize: 11, color: T.textDim, textAlign: 'center' }}>
                  Owner only
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage section */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: RADIUS.card,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>Current Usage</div>

        {usageData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <UsageBar
              label="Menu items"
              used={usageData.menuItems}
              max={limits.maxMenuItems}
            />
            <UsageBar
              label="Locations"
              used={usageData.locations}
              max={limits.maxLocations}
            />
            <UsageBar
              label="Delivery platforms connected"
              used={usageData.deliveryPlatforms}
              max={limits.deliveryPlatforms === 0 ? 0 : limits.deliveryPlatforms}
            />
            {currentPlan === 'FREE' && usageData.menuItems >= 40 && (
              <div
                style={{
                  background: `${T.gold}12`,
                  border: `1px solid ${T.gold}30`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 12,
                  color: T.gold,
                }}
              >
                {usageData.menuItems >= 49
                  ? '⚠ Almost at the 50-item limit. Upgrade to Starter for unlimited items.'
                  : usageData.menuItems >= 45
                  ? `You're at ${usageData.menuItems}/50 menu items — getting close to your free limit.`
                  : `You're at ${usageData.menuItems}/50 menu items.`}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: T.textDim }}>Loading usage…</div>
        )}
      </div>

      {/* Stripe portal section */}
      {isOwner && currentPlan !== 'FREE' && (
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: RADIUS.card,
            padding: 20,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Billing Management</div>
          <div style={{ fontSize: 13, color: T.textMid, marginBottom: 14, lineHeight: 1.5 }}>
            Update your payment method, download invoices, or cancel your subscription via
            the Stripe Customer Portal.
          </div>
          <Button variant="secondary" onClick={() => void openPortal()} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : '↗ Open Stripe Customer Portal'}
          </Button>
        </div>
      )}

      {/* Upgrade modal */}
      {upgradeTarget && (
        <UpgradeModal
          feature={`Upgrade to ${upgradeTarget.charAt(0) + upgradeTarget.slice(1).toLowerCase()}`}
          description={`Unlock more features with the ${upgradeTarget} plan.`}
          required={upgradeTarget}
          billingPeriod={billingPeriod}
          onClose={() => setUpgradeTarget(null)}
        />
      )}
    </div>
  );
}
