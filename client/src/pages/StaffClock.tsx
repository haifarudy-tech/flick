import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { T, RADIUS } from '@/tokens';
import type { RosterEntry } from '@/types/staff';

const API_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  KITCHEN: 'Kitchen',
};

// ─── PIN pad ──────────────────────────────────────────────────────────────────

function PinPad({
  pin,
  onChange,
  onSubmit,
  onBack,
  loading,
  error,
}: {
  pin: string;
  onChange: (p: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}) {
  const handleKey = (k: string) => {
    if (k === 'back') { onChange(pin.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    onChange(next);
    if (next.length === 4) {
      // tiny delay so user sees 4th dot fill
      setTimeout(onSubmit, 80);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      {/* dots */}
      <div style={{ display: 'flex', gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: i < pin.length ? T.accent : T.border,
              transition: 'background 0.15s',
            }}
          />
        ))}
      </div>

      {error && (
        <div style={{ color: T.red, fontSize: 13, fontWeight: 600 }}>{error}</div>
      )}

      {/* keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 10 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'].map((k) => {
          const isAction = k === '←' || k === '✓';
          const isConfirm = k === '✓';
          return (
            <button
              key={k}
              onClick={() => k === '✓' ? onSubmit() : k === '←' ? handleKey('back') : handleKey(k)}
              disabled={loading || (isConfirm && pin.length < 4)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                border: `1px solid ${isConfirm ? T.accent + '60' : T.border}`,
                background: isConfirm
                  ? pin.length === 4 ? `linear-gradient(135deg, ${T.accent}, ${T.accentDark})` : T.surface
                  : T.card,
                color: isConfirm ? '#fff' : T.text,
                fontSize: isAction ? 20 : 24,
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.1s',
              }}
            >
              {loading && isConfirm ? '…' : k}
            </button>
          );
        })}
      </div>

      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: T.textMid, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
      >
        ← Back to roster
      </button>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

type Stage = 'loading' | 'error' | 'roster' | 'pin' | 'done';

export function StaffClockPage() {
  const [params] = useSearchParams();
  const slug = params.get('b') ?? '';

  const [stage, setStage] = useState<Stage>('loading');
  const [businessName, setBusinessName] = useState('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [selectedUser, setSelectedUser] = useState<RosterEntry | null>(null);
  const [pin, setPin] = useState('');
  const [clockError, setClockError] = useState('');
  const [clockLoading, setClockLoading] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');

  const loadRoster = useCallback(async () => {
    if (!slug) { setFetchError('No business slug. Add ?b=<slug> to the URL.'); setStage('error'); return; }
    setStage('loading');
    try {
      const res = await fetch(`${API_URL}/api/v1/staff/roster?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('Business not found');
      const data = await res.json() as { businessName: string; staff: RosterEntry[] };
      setBusinessName(data.businessName);
      setRoster(data.staff);
      setStage('roster');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load staff');
      setStage('error');
    }
  }, [slug]);

  useEffect(() => { void loadRoster(); }, [loadRoster]);

  // Refresh roster every 30s when on the roster screen
  useEffect(() => {
    if (stage !== 'roster') return;
    const id = setInterval(() => { void loadRoster(); }, 30_000);
    return () => clearInterval(id);
  }, [stage, loadRoster]);

  const selectStaff = (member: RosterEntry) => {
    setSelectedUser(member);
    setPin('');
    setClockError('');
    setStage('pin');
  };

  const handleClockToggle = async () => {
    if (!selectedUser || pin.length < 4) return;
    setClockLoading(true);
    setClockError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/staff/clock-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, pin, slug }),
      });
      const data = await res.json() as { ok?: boolean; clockedIn?: boolean; message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Invalid PIN');
      setDoneMsg(data.clockedIn ? `✓ ${selectedUser.name} clocked IN` : `✓ ${selectedUser.name} clocked OUT`);
      setStage('done');
      // Return to roster after 2.5s
      setTimeout(() => { void loadRoster(); setStage('roster'); }, 2_500);
    } catch (err) {
      setClockError(err instanceof Error ? err.message : 'Clock action failed');
      setPin('');
    } finally {
      setClockLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"DM Sans", sans-serif',
        padding: 24,
      }}
    >
      {/* Branding */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 24,
            color: '#fff',
            margin: '0 auto 12px',
            boxShadow: `0 6px 20px ${T.accent}40`,
          }}
        >
          F
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>
          {businessName || 'Flick'}
        </div>
        <div style={{ fontSize: 13, color: T.textMid, marginTop: 2 }}>Staff Clock In / Out</div>
      </div>

      {/* Stage: loading */}
      {stage === 'loading' && (
        <div style={{ color: T.textDim, fontSize: 14 }}>Loading roster…</div>
      )}

      {/* Stage: error */}
      {stage === 'error' && (
        <div style={{ textAlign: 'center', color: T.red }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 8 }}>Error</div>
          <div style={{ fontSize: 13, color: T.textMid, marginBottom: 20 }}>{fetchError}</div>
          <button onClick={() => void loadRoster()} style={{ ...actionBtn, background: T.accent, color: '#fff' }}>Retry</button>
        </div>
      )}

      {/* Stage: roster */}
      {stage === 'roster' && (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ fontSize: 14, color: T.textMid, textAlign: 'center', marginBottom: 20 }}>
            Tap your name to clock in or out
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            {roster.map((member) => (
              <button
                key={member.id}
                onClick={() => selectStaff(member)}
                style={{
                  background: T.card,
                  border: `1px solid ${member.clockedIn ? T.green + '60' : T.border}`,
                  borderRadius: RADIUS.card,
                  padding: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: T.surface,
                      border: `2px solid ${member.clockedIn ? T.green : T.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 800,
                      color: T.text,
                    }}
                  >
                    {member.avatarInitials}
                  </div>
                  {member.clockedIn && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 1,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: T.green,
                        border: `2px solid ${T.bg}`,
                      }}
                    />
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{member.name}</div>
                  <div style={{ fontSize: 10, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: member.clockedIn ? T.green : T.textDim,
                    background: member.clockedIn ? `${T.green}15` : T.surface,
                    padding: '3px 10px',
                    borderRadius: RADIUS.pill,
                    border: `1px solid ${member.clockedIn ? T.green + '40' : T.border}`,
                  }}
                >
                  {member.clockedIn
                    ? `IN · ${member.todayHours.toFixed(1)}h`
                    : 'OUT'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stage: PIN entry */}
      {stage === 'pin' && selectedUser && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: T.surface,
                border: `2px solid ${selectedUser.clockedIn ? T.green : T.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                color: T.text,
                margin: '0 auto 12px',
              }}
            >
              {selectedUser.avatarInitials}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{selectedUser.name}</div>
            <div style={{ fontSize: 13, color: T.textMid, marginTop: 4 }}>
              {selectedUser.clockedIn ? 'Enter PIN to clock OUT' : 'Enter PIN to clock IN'}
            </div>
          </div>
          <PinPad
            pin={pin}
            onChange={setPin}
            onSubmit={() => void handleClockToggle()}
            onBack={() => { setStage('roster'); setSelectedUser(null); }}
            loading={clockLoading}
            error={clockError}
          />
        </div>
      )}

      {/* Stage: done */}
      {stage === 'done' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>
            {doneMsg.includes('IN') ? '✅' : '👋'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{doneMsg}</div>
          <div style={{ fontSize: 13, color: T.textDim, marginTop: 8 }}>Returning to roster…</div>
        </div>
      )}

      {/* Current time */}
      <ClockDisplay />
    </div>
  );
}

function ClockDisplay() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 28, fontSize: 13, color: T.textDim, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      {time}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: RADIUS.sm,
  border: 'none',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
