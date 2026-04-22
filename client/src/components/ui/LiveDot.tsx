import { T } from '@/tokens';

export function LiveDot({ online = true }: { online?: boolean }) {
  const c = online ? T.green : T.textDim;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: online ? 'rgba(78,168,107,0.12)' : 'transparent',
        padding: '6px 12px',
        borderRadius: 20,
        border: `1px solid ${c}30`,
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
      <span style={{ color: c, fontSize: 12, fontWeight: 700 }}>
        {online ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}
