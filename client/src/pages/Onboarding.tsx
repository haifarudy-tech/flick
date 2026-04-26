import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T, RADIUS } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/auth';
import { api, ApiError } from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const CURRENCIES = ['GBP', 'EUR', 'USD', 'CAD', 'AUD'] as const;

const QUICK_ITEMS = [
  { name: 'Espresso', price: '2.50' },
  { name: 'Cappuccino', price: '3.50' },
  { name: 'Croissant', price: '3.00' },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 4,
            background: i < step ? T.accent : i === step ? `${T.accent}60` : T.border,
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );
}

// ─── Step wrappers ────────────────────────────────────────────────────────────

function StepHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.4px', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>{subtitle}</div>
    </div>
  );
}

// ─── Step 1: Business details ─────────────────────────────────────────────────

interface BusinessDetails {
  name: string;
  address: string;
  city: string;
  postcode: string;
  logo: string;
  vatNumber: string;
  vatRate: string;
  currency: string;
}

function Step1({
  data,
  onChange,
  onNext,
  loading,
}: {
  data: BusinessDetails;
  onChange: (d: Partial<BusinessDetails>) => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div>
      <StepHeader
        icon="🏪"
        title="Tell us about your business"
        subtitle="This information appears on receipts and is used to set up your account correctly."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <Label>Business name *</Label>
          <Input
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Sunrise Café"
          />
        </div>
        <div>
          <Label>Address</Label>
          <Input
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="123 High Street"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>City</Label>
            <Input
              value={data.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="London"
            />
          </div>
          <div>
            <Label>Postcode</Label>
            <Input
              value={data.postcode}
              onChange={(e) => onChange({ postcode: e.target.value })}
              placeholder="EC1A 1BB"
            />
          </div>
        </div>
        <div>
          <Label>Logo URL</Label>
          <Input
            value={data.logo}
            onChange={(e) => onChange({ logo: e.target.value })}
            placeholder="https://your-cdn.com/logo.png"
          />
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>
            Paste a public URL — full image upload coming soon
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>VAT number</Label>
            <Input
              value={data.vatNumber}
              onChange={(e) => onChange({ vatNumber: e.target.value })}
              placeholder="GB123456789"
            />
          </div>
          <div>
            <Label>VAT rate (%)</Label>
            <Input
              type="number"
              value={data.vatRate}
              onChange={(e) => onChange({ vatRate: e.target.value })}
              placeholder="20"
            />
          </div>
        </div>
        <div>
          <Label>Currency</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ currency: c })}
                style={{
                  padding: '7px 16px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: data.currency === c ? T.accentGlow : 'transparent',
                  border: `1px solid ${data.currency === c ? `${T.accent}55` : T.border}`,
                  color: data.currency === c ? T.accent : T.textMid,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <Button full onClick={onNext} disabled={loading || !data.name.trim()}>
          {loading ? 'Saving…' : 'Continue →'}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Quick menu items ─────────────────────────────────────────────────

interface QuickItem {
  name: string;
  price: string;
  selected: boolean;
}

function Step2({
  items,
  setItems,
  onNext,
  onSkip,
  loading,
}: {
  items: QuickItem[];
  setItems: (items: QuickItem[]) => void;
  onNext: () => void;
  onSkip: () => void;
  loading: boolean;
}) {
  const toggleItem = (i: number) => {
    const next = [...items];
    next[i] = { ...next[i]!, selected: !next[i]!.selected };
    setItems(next);
  };

  const anySelected = items.some((i) => i.selected);

  return (
    <div>
      <StepHeader
        icon="☕"
        title="Add your first menu items"
        subtitle="Select a few quick-start items to populate your menu — you can edit and add more later."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {items.map((item, idx) => (
          <button
            key={item.name}
            type="button"
            onClick={() => toggleItem(idx)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderRadius: 12,
              cursor: 'pointer',
              background: item.selected ? T.accentGlow : T.surface,
              border: `1px solid ${item.selected ? `${T.accent}55` : T.border}`,
              color: T.text,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: item.selected ? T.accent : 'transparent',
                  border: `2px solid ${item.selected ? T.accent : T.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#fff',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {item.selected && '✓'}
              </div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</span>
            </div>
            <span style={{ fontWeight: 900, fontSize: 14, color: item.selected ? T.accent : T.textMid }}>
              £{item.price}
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button full onClick={onNext} disabled={loading || !anySelected}>
          {loading ? 'Adding items…' : `Add ${items.filter((i) => i.selected).length} item(s) →`}
        </Button>
        <Button variant="ghost" full onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Delivery platforms ───────────────────────────────────────────────

function Step3({ plan, onNext, onSkip }: { plan: string; onNext: () => void; onSkip: () => void }) {
  const navigate = useNavigate();

  const canConnect = plan === 'STARTER' || plan === 'PRO' || plan === 'ENTERPRISE';

  return (
    <div>
      <StepHeader
        icon="🛵"
        title="Connect delivery platforms"
        subtitle="Receive Uber Eats, Deliveroo, and Just Eat orders directly in Flick — no tablet juggling."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'UBER_EATS', label: 'Uber Eats', icon: '🟡', minPlan: 'STARTER' },
          { key: 'DELIVEROO', label: 'Deliveroo', icon: '🟢', minPlan: 'STARTER' },
          { key: 'JUST_EAT', label: 'Just Eat', icon: '🟠', minPlan: 'PRO' },
        ].map((p) => {
          const available = canConnect && (p.minPlan === 'STARTER' || plan === 'PRO' || plan === 'ENTERPRISE');
          return (
            <div
              key={p.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                background: T.surface,
                border: `1px solid ${T.border}`,
                opacity: available ? 1 : 0.4,
              }}
            >
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              <span style={{ fontWeight: 700, flex: 1 }}>{p.label}</span>
              {available ? (
                <span style={{ fontSize: 11, color: T.textDim }}>Connect in Delivery settings</span>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.textDim,
                    background: T.border,
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}
                >
                  {p.minPlan}+
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!canConnect && (
        <div
          style={{
            background: `${T.gold}10`,
            border: `1px solid ${T.gold}25`,
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: T.gold,
            marginBottom: 16,
          }}
        >
          Delivery integrations require Starter plan or higher. Upgrade in Settings → Billing.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canConnect && (
          <Button
            full
            onClick={() => {
              onNext();
              navigate('/delivery');
            }}
          >
            Set up delivery →
          </Button>
        )}
        <Button variant={canConnect ? 'ghost' : 'primary'} full onClick={onSkip}>
          {canConnect ? 'Set up later' : 'Continue →'}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Staff ────────────────────────────────────────────────────────────

function Step4({ plan, onNext, onSkip }: { plan: string; onNext: () => void; onSkip: () => void }) {
  const navigate = useNavigate();
  const canManageStaff = plan === 'PRO' || plan === 'ENTERPRISE';

  return (
    <div>
      <StepHeader
        icon="👥"
        title="Set up your team"
        subtitle="Add staff members, assign roles, and track hours with the built-in timesheet."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[
          { icon: '◉', title: 'Add staff members', desc: 'Create accounts for your team with role-based access.' },
          { icon: '⏱', title: 'Clock in/out', desc: 'Staff clock in via PIN on any device — hours are logged automatically.' },
          { icon: '📊', title: 'Timesheets', desc: 'View hours worked and pay calculations per staff member.' },
        ].map((f) => (
          <div
            key={f.title}
            style={{
              display: 'flex',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              background: T.surface,
              border: `1px solid ${T.border}`,
              opacity: canManageStaff ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 16, marginTop: 1 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: T.textMid }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
      {!canManageStaff && (
        <div
          style={{
            background: `${T.purple}10`,
            border: `1px solid ${T.purple}25`,
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: T.purple,
            marginBottom: 16,
          }}
        >
          Staff management requires the Pro plan. Upgrade anytime in Settings → Billing.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canManageStaff && (
          <Button
            full
            onClick={() => {
              onNext();
              navigate('/staff');
            }}
          >
            Add staff →
          </Button>
        )}
        <Button variant={canManageStaff ? 'ghost' : 'primary'} full onClick={onSkip}>
          {canManageStaff ? 'Set up later' : 'Continue →'}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function Step5({ businessName, onFinish }: { businessName: string; onFinish: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 20 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px', marginBottom: 10 }}>
        You're all set, {businessName || 'there'}!
      </div>
      <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, marginBottom: 32 }}>
        Your Flick account is ready to go. Start taking orders from the POS, manage your
        menu, or explore the analytics dashboard.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 32,
          textAlign: 'left',
        }}
      >
        {[
          { icon: '⊞', label: 'POS', desc: 'Take orders', path: '/pos' },
          { icon: '☰', label: 'Menu', desc: 'Edit your menu', path: '/menu-manager' },
          { icon: '◈', label: 'Analytics', desc: 'View sales', path: '/analytics' },
        ].map((item) => (
          <div
            key={item.path}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 800 }}>{item.label}</div>
            <div style={{ fontSize: 11, color: T.textDim }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <Button full onClick={onFinish}>
        Go to POS →
      </Button>
    </div>
  );
}

// ─── Main Onboarding page ─────────────────────────────────────────────────────

const ONBOARDING_KEY = 'flick_onboarding_done';

export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const business = useAuthStore((s) => s.business);
  const plan = business?.plan ?? 'FREE';

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [bizDetails, setBizDetails] = useState<BusinessDetails>({
    name: business?.name ?? '',
    address: '',
    city: '',
    postcode: '',
    logo: '',
    vatNumber: '',
    vatRate: '20',
    currency: 'GBP',
  });

  // Step 2 state
  const [quickItems, setQuickItems] = useState<QuickItem[]>(
    QUICK_ITEMS.map((item) => ({ ...item, selected: true })),
  );

  const finish = () => {
    markOnboardingDone();
    navigate('/pos', { replace: true });
  };

  // Step 1 submit
  const submitStep1 = async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: bizDetails.name,
        address: bizDetails.address || undefined,
        city: bizDetails.city || undefined,
        postcode: bizDetails.postcode || undefined,
        vatNumber: bizDetails.vatNumber || undefined,
        vatRate: bizDetails.vatRate ? parseFloat(bizDetails.vatRate) : undefined,
        currency: bizDetails.currency,
      };
      if (bizDetails.logo) body.logo = bizDetails.logo;
      await api.put('/api/v1/business', body);
      setStep(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save business details.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 submit — create a default category + items
  const submitStep2 = async () => {
    const selected = quickItems.filter((i) => i.selected);
    if (!selected.length) {
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      // Create a default category
      const catRes = await api.post<{ id: string }>('/api/v1/menu/categories', {
        name: 'Menu',
        sortOrder: 0,
      });
      const categoryId = catRes.id;
      // Create items in parallel
      await Promise.all(
        selected.map((item) =>
          api.post('/api/v1/menu/items', {
            name: item.name,
            basePrice: parseFloat(item.price),
            categoryId,
            isAvailable: true,
          }),
        ),
      );
      setStep(2);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add menu items.');
    } finally {
      setLoading(false);
    }
  };

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
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 40 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 22,
              color: '#fff',
              boxShadow: `0 6px 20px ${T.accent}40`,
            }}
          >
            F
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>Flick</div>
        </div>

        {/* Card */}
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: '0.5px', marginBottom: 12 }}>
            STEP {step + 1} OF {TOTAL_STEPS}
          </div>
          <ProgressBar step={step} />

          {step === 0 && (
            <Step1
              data={bizDetails}
              onChange={(d) => setBizDetails((prev) => ({ ...prev, ...d }))}
              onNext={() => void submitStep1()}
              loading={loading}
            />
          )}
          {step === 1 && (
            <Step2
              items={quickItems}
              setItems={setQuickItems}
              onNext={() => void submitStep2()}
              onSkip={() => setStep(2)}
              loading={loading}
            />
          )}
          {step === 2 && (
            <Step3 plan={plan} onNext={() => setStep(3)} onSkip={() => setStep(3)} />
          )}
          {step === 3 && (
            <Step4 plan={plan} onNext={() => setStep(4)} onSkip={() => setStep(4)} />
          )}
          {step === 4 && (
            <Step5 businessName={bizDetails.name || business?.name || ''} onFinish={finish} />
          )}
        </div>

        {step < 4 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={finish}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: T.textDim,
                fontFamily: 'inherit',
              }}
            >
              Skip setup and go to POS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
