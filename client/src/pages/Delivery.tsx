import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { LiveDot } from '@/components/ui/LiveDot';
import { useOrders, useOrderSocket } from '@/hooks/useOrders';
import { useDeliveryPlatforms } from '@/hooks/useDelivery';
import type { Order } from '@/types/order';
import { DELIVERY_PLATFORMS } from '@/types/delivery';
import { DeliveryLiveOrdersTab } from '@/components/delivery/DeliveryLiveOrdersTab';
import { DeliveryPlatformsTab } from '@/components/delivery/DeliveryPlatformsTab';
import { DeliveryAnalyticsTab } from '@/components/delivery/DeliveryAnalyticsTab';
import { DeliverySettingsTab } from '@/components/delivery/DeliverySettingsTab';

type TabKey = 'live' | 'platforms' | 'analytics' | 'settings';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'live', label: 'Live Orders' },
  { key: 'platforms', label: 'Platforms' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function isDeliveryOrder(o: Order): boolean {
  return (
    o.source === 'UBER_EATS' ||
    o.source === 'DELIVEROO' ||
    o.source === 'JUST_EAT' ||
    o.source === 'DIRECT_QR'
  );
}

export function DeliveryPage() {
  const { data, isLoading } = useOrders();
  const { data: platformsData } = useDeliveryPlatforms();
  useOrderSocket();

  const [tab, setTab] = useState<TabKey>('live');

  const orders = data?.orders ?? [];
  const platforms = platformsData?.platforms ?? [];

  const deliveryOrders = useMemo(
    () => orders.filter(isDeliveryOrder),
    [orders],
  );

  const todayOrders = useMemo(
    () => deliveryOrders.filter((o) => isToday(o.createdAt)),
    [deliveryOrders],
  );

  const kpis = useMemo(() => {
    let gross = 0;
    let commission = 0;
    let net = 0;
    for (const o of todayOrders) {
      if (o.status === 'CANCELLED') continue;
      gross += o.total;
      const netVal = o.netAfterCommission ?? o.total;
      net += netVal;
      commission += o.total - netVal;
    }
    const count = todayOrders.filter((o) => o.status !== 'CANCELLED').length;
    return {
      gross,
      commission,
      net,
      count,
      avg: count > 0 ? gross / count : 0,
    };
  }, [todayOrders]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px 0',
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              Delivery Hub
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textDim }}>
              {platforms.filter((p) => p.status === 'CONNECTED').length +
                1}{' '}
              platforms · {kpis.count} orders today
            </p>
          </div>
          <LiveDot />
        </div>

        {/* KPI strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            paddingBottom: 14,
          }}
        >
          <Kpi label="Gross Revenue" value={`£${kpis.gross.toFixed(2)}`} />
          <Kpi
            label="Commission Paid"
            value={`£${kpis.commission.toFixed(2)}`}
            color={T.red}
            sub="Lost to platforms"
          />
          <Kpi
            label="Net Revenue"
            value={`£${kpis.net.toFixed(2)}`}
            color={T.green}
            sub="You keep"
          />
          <Kpi label="Total Orders" value={String(kpis.count)} />
          <Kpi label="Avg Order Value" value={`£${kpis.avg.toFixed(2)}`} />
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            marginTop: 4,
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active
                    ? `2px solid ${T.accent}`
                    : '2px solid transparent',
                  color: active ? T.accent : T.textMid,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', background: T.bg }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>
            Loading delivery data…
          </div>
        ) : (
          <>
            {tab === 'live' && (
              <DeliveryLiveOrdersTab orders={deliveryOrders} />
            )}
            {tab === 'platforms' && (
              <DeliveryPlatformsTab
                todayOrders={todayOrders}
                platforms={platforms}
              />
            )}
            {tab === 'analytics' && (
              <DeliveryAnalyticsTab
                todayOrders={todayOrders}
                platforms={platforms}
              />
            )}
            {tab === 'settings' && (
              <DeliverySettingsTab platforms={platforms} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: T.textDim,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: color ?? T.text,
          letterSpacing: '-0.5px',
          marginBottom: sub ? 2 : 0,
        }}
        className="num"
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: T.textDim }}>{sub}</div>}
    </div>
  );
}

// Export helper so sub-tabs can refer to the canonical platform list consistently.
export { DELIVERY_PLATFORMS };
