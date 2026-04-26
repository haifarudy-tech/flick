import { NavLink, useNavigate } from 'react-router-dom';
import { T } from '@/tokens';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import type { Plan } from '@flick/shared/types';

const PLAN_COLOR: Record<Plan, string> = {
  FREE: T.textDim,
  STARTER: T.blue,
  PRO: T.accent,
  ENTERPRISE: T.gold,
};

// Icons are plain unicode glyphs to match the reference exactly.
const NAV = [
  { key: 'pos', icon: '⊞', label: 'POS', to: '/pos' },
  { key: 'orders', icon: '◫', label: 'Orders', to: '/orders' },
  { key: 'kitchen', icon: '🍳', label: 'Kitchen', to: '/kitchen' },
  { key: 'delivery', icon: '🛵', label: 'Delivery', to: '/delivery' },
  { key: 'analytics', icon: '◈', label: 'Stats', to: '/analytics' },
  { key: 'menu', icon: '☰', label: 'Menu', to: '/menu-manager' },
  { key: 'staff', icon: '◉', label: 'Staff', to: '/staff' },
  { key: 'settings', icon: '⚙', label: 'Settings', to: '/settings' },
] as const;

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const business = useAuthStore((s) => s.business);
  const clear = useAuthStore((s) => s.clear);
  const nav = useNavigate();
  const plan = business?.plan ?? 'FREE';

  const signOut = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      /* non-fatal */
    }
    clear();
    nav('/login', { replace: true });
  };

  const initials = user?.name
    ? user.name
        .split(/\s+/)
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—';

  return (
    <nav
      aria-label="Primary"
      style={{
        width: 64,
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: 2,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: 16,
          color: '#fff',
          marginBottom: 16,
          boxShadow: `0 4px 14px ${T.accent}40`,
        }}
      >
        F
      </div>

      {NAV.map((n) => (
        <NavLink
          key={n.key}
          to={n.to}
          title={n.label}
          style={({ isActive }) => ({
            width: 44,
            height: 44,
            borderRadius: 12,
            background: isActive ? T.accentGlow : 'transparent',
            border: isActive ? `1px solid ${T.accent}35` : '1px solid transparent',
            color: isActive ? T.accent : T.textDim,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            textDecoration: 'none',
            transition: 'all 0.15s',
          })}
        >
          <span style={{ fontSize: 15 }}>{n.icon}</span>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2px' }}>
            {n.label.slice(0, 3)}
          </span>
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      {/* Plan badge */}
      <NavLink
        to="/settings/billing"
        title={`${plan} plan — click to manage`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 18,
          borderRadius: 10,
          background: `${PLAN_COLOR[plan]}18`,
          border: `1px solid ${PLAN_COLOR[plan]}35`,
          textDecoration: 'none',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 7,
            fontWeight: 900,
            color: PLAN_COLOR[plan],
            letterSpacing: '0.4px',
          }}
        >
          {plan}
        </span>
      </NavLink>

      <button
        onClick={signOut}
        title="Sign out"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${T.accent}, ${T.gold})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
          color: '#fff',
          marginBottom: 8,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {initials}
      </button>
    </nav>
  );
}
