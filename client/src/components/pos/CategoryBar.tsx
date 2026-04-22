import { T } from '@/tokens';
import type { Category } from '@/types/menu';

export function CategoryBar({
  categories,
  active,
  onChange,
}: {
  categories: Category[];
  active: string;
  onChange: (id: string) => void;
}) {
  const items = [{ id: 'all', name: 'All' }, ...categories.map((c) => ({ id: c.id, name: c.name }))];
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '10px 16px',
        overflowX: 'auto',
        flexShrink: 0,
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {items.map((c) => {
        const isActive = active === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              border: isActive ? 'none' : `1px solid ${T.border}`,
              background: isActive ? T.accent : 'transparent',
              color: isActive ? '#fff' : T.textMid,
              fontFamily: 'inherit',
            }}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
