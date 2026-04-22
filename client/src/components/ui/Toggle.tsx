import { T } from '@/tokens';

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: on ? T.accent : T.border,
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: 'none',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
}
