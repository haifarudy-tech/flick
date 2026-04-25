import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { useStripeTerminal } from '@/lib/stripeTerminal';
import { TERMINAL_STAGE_LABEL } from '@/lib/stripeTerminal';

const STATUS_COLOR: Record<string, string> = {
  idle: T.textDim,
  loading_sdk: T.gold,
  discovering: T.gold,
  connecting: T.gold,
  ready: T.green,
  collecting: T.accent,
  processing: T.accent,
  capturing: T.accent,
  success: T.green,
  error: T.red,
};

export function SettingsPaymentsPage() {
  const terminal = useStripeTerminal();

  const isConnected = terminal.stage === 'ready' || terminal.stage === 'collecting' ||
    terminal.stage === 'processing' || terminal.stage === 'capturing' || terminal.stage === 'success';
  const isBusy = terminal.stage === 'loading_sdk' || terminal.stage === 'discovering' ||
    terminal.stage === 'connecting';

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 32,
        maxWidth: 600,
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Payments</div>
        <div style={{ fontSize: 13, color: T.textMid, marginTop: 4 }}>
          Stripe Terminal reader configuration
        </div>
      </div>

      {/* Reader card */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Stripe Terminal Reader</div>
            <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>
              Simulated reader (dev mode)
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 20,
              background: `${STATUS_COLOR[terminal.stage] ?? T.textDim}15`,
              border: `1px solid ${STATUS_COLOR[terminal.stage] ?? T.textDim}30`,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: STATUS_COLOR[terminal.stage] ?? T.textDim,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: STATUS_COLOR[terminal.stage] ?? T.textDim,
              }}
            >
              {TERMINAL_STAGE_LABEL[terminal.stage]}
            </span>
          </div>
        </div>

        {terminal.error && (
          <div
            style={{
              background: 'rgba(201,84,84,0.1)',
              border: `1px solid ${T.red}30`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              color: T.red,
              marginBottom: 14,
            }}
          >
            {terminal.error}
          </div>
        )}

        <InfoRow label="Reader type" value="Stripe simulated reader" />
        <InfoRow label="Mode" value="Test (no physical hardware required)" />
        <InfoRow label="Currency" value="GBP" />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {!isConnected && (
            <Button
              variant="primary"
              onClick={() => void terminal.ensureConnected()}
              disabled={isBusy}
            >
              {isBusy ? 'Connecting…' : 'Connect reader'}
            </Button>
          )}
          {isConnected && (
            <Button variant="secondary" onClick={() => terminal.reset()}>
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* How it works */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['1', 'Simulated reader', 'In development, Stripe provides a software reader that auto-accepts test cards — no hardware needed.'],
            ['2', 'Production readers', 'For live use, connect a BBPOS WisePOS E or Stripe Reader M2 via the Stripe Dashboard.'],
            ['3', 'Split & tips', 'Card payments support tips (added to the payment intent) and split checkout with a cash leg.'],
            ['4', 'Refunds', 'Card refunds flow through Stripe automatically. Cash refunds are logged as an audit record.'],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: T.accentGlow,
                  border: `1px solid ${T.accent}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.accent,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {num}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
        padding: '6px 0',
        borderBottom: `1px solid ${T.border}`,
        color: T.textMid,
      }}
    >
      <span>{label}</span>
      <span style={{ color: T.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
