import { useState, useMemo } from 'react';
import { T, RADIUS } from '@/tokens';
import { fmt, fmtK, fmtPercent } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';
import {
  useAnalyticsSummary,
  useAnalyticsHourly,
  useTopItems,
  useStaffPerformance,
  useDeliveryBreakdown,
  useAnalyticsSocket,
} from '@/hooks/useAnalytics';
import type { DatePreset } from '@/types/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeRange(preset: DatePreset, customFrom: string, customTo: string) {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  };
  if (preset === 'today') return { from: startOfDay(now), to: now };
  if (preset === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const end = new Date(startOfDay(now));
    end.setTime(end.getTime() - 1);
    return { from: startOfDay(yest), to: end };
  }
  if (preset === 'week') {
    const start = new Date(startOfDay(now));
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { from: start, to: now };
  }
  if (preset === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  // custom
  const from = customFrom ? new Date(customFrom) : startOfDay(now);
  const to = customTo ? new Date(customTo + 'T23:59:59') : now;
  return { from, to };
}

const SOURCE_LABELS: Record<string, string> = {
  POS: 'POS',
  UBER_EATS: 'Uber Eats',
  DELIVEROO: 'Deliveroo',
  JUST_EAT: 'Just Eat',
  DIRECT_QR: 'Direct QR',
};

const SOURCE_COLORS: Record<string, string> = {
  POS: T.accent,
  UBER_EATS: '#06B6D4',
  DELIVEROO: T.blue,
  JUST_EAT: T.gold,
  DIRECT_QR: T.green,
};

const TYPE_LABELS: Record<string, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
};

const TYPE_COLORS: Record<string, string> = {
  DINE_IN: T.green,
  TAKEAWAY: T.accent,
  DELIVERY: T.blue,
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: T.purple,
  MANAGER: T.blue,
  CASHIER: T.accent,
  KITCHEN: T.gold,
};

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color = T.text,
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
        borderRadius: RADIUS.card,
        padding: '16px 20px',
        minWidth: 0,
        flex: '1 1 140px',
      }}
    >
      <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12, letterSpacing: '0.3px' }}>
      {children}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  total,
  color,
  rightLabel,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  rightLabel?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: T.textMid }}>{label}</span>
        <span style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>
          {rightLabel ?? fmtK(value)} <span style={{ color: T.textDim, fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(
    () => computeRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { data: summary, isLoading: loadSum } = useAnalyticsSummary(from, to);
  const { data: hourlyData } = useAnalyticsHourly(from, to);
  const { data: itemsData } = useTopItems(from, to);
  const { data: staffData } = useStaffPerformance(from, to);
  const { data: deliveryData } = useDeliveryBreakdown(from, to);

  useAnalyticsSocket(from, to);

  const accessToken = useAuthStore((s) => s.accessToken);

  const handleExport = async () => {
    const API_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';
    try {
      const resp = await fetch(
        `${API_URL}/api/v1/analytics/export?from=${from.toISOString()}&to=${to.toISOString()}`,
        { headers: { Authorization: `Bearer ${accessToken ?? ''}` }, credentials: 'include' },
      );
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flick-analytics.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // non-fatal
    }
  };

  // Hourly chart data
  const hours = hourlyData?.hours ?? [];
  const maxRevenue = Math.max(...hours.map((h) => h.revenue), 0.01);
  const peakHour = hours.reduce(
    (best, h) => (h.revenue > (hours[best]?.revenue ?? 0) ? h.hour : best),
    0,
  );

  // Delivery commission drain
  const deliveryPlatforms = deliveryData?.byPlatform ?? {};
  const totalGross = Object.values(deliveryPlatforms).reduce((s, p) => s + p.gross, 0);
  const totalNet = Object.values(deliveryPlatforms).reduce((s, p) => s + p.net, 0);
  const totalCommission = totalGross - totalNet;
  const posRevenue = summary?.bySource?.['POS'] ?? 0;
  const grandGross = (summary?.revenue ?? 0);
  const grandNet = grandGross - totalCommission;

  // Order type totals for progress bars
  const byTypeTotal = Object.values(summary?.byType ?? {}).reduce((s, v) => s + v, 0);
  const bySourceTotal = summary?.revenue ?? 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: T.bg,
        color: T.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, marginRight: 8 }}>Analytics</div>

        {/* Date range pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              style={{
                padding: '5px 12px',
                borderRadius: RADIUS.pill,
                border: `1px solid ${preset === p.key ? T.accent : T.border}`,
                background: preset === p.key ? T.accentGlow : 'transparent',
                color: preset === p.key ? T.accent : T.textMid,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom range inputs */}
        {preset === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: RADIUS.sm,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.text,
                fontSize: 12,
              }}
            />
            <span style={{ color: T.textDim, fontSize: 11 }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: RADIUS.sm,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.text,
                fontSize: 12,
              }}
            />
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Export button */}
        <button
          onClick={handleExport}
          style={{
            padding: '7px 16px',
            borderRadius: RADIUS.sm,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.textMid,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* KPI row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard
            label="Revenue"
            value={loadSum ? '—' : fmtK(summary?.revenue ?? 0)}
            sub={`${summary?.orders ?? 0} orders`}
            color={T.accent}
          />
          <KpiCard
            label="Orders"
            value={loadSum ? '—' : String(summary?.orders ?? 0)}
            sub={`avg ${fmt(summary?.avgBasket ?? 0)}`}
          />
          <KpiCard
            label="Avg Basket"
            value={loadSum ? '—' : fmt(summary?.avgBasket ?? 0)}
          />
          <KpiCard
            label="Tips Collected"
            value={loadSum ? '—' : fmt(summary?.totalTips ?? 0)}
            color={T.gold}
          />
          <KpiCard
            label="Refunds Issued"
            value={loadSum ? '—' : fmt(summary?.totalRefunds ?? 0)}
            color={T.red}
          />
        </div>

        {/* Hourly revenue chart */}
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: RADIUS.card,
            padding: '20px 20px 12px',
          }}
        >
          <SectionHeader>Revenue by Hour</SectionHeader>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
            {hours.map((bucket) => {
              const isPeak = bucket.hour === peakHour && bucket.revenue > 0;
              const heightPct = maxRevenue > 0 ? (bucket.revenue / maxRevenue) * 100 : 0;
              return (
                <div
                  key={bucket.hour}
                  title={`${String(bucket.hour).padStart(2, '0')}:00 — ${fmt(bucket.revenue)} (${bucket.orders} orders)`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                    cursor: 'default',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(heightPct, bucket.revenue > 0 ? 4 : 0)}%`,
                      background: isPeak
                        ? `linear-gradient(180deg, ${T.accent}, ${T.accentDark})`
                        : T.borderLight,
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s ease',
                      boxShadow: isPeak ? `0 0 8px ${T.accent}60` : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* Hour labels */}
          <div style={{ display: 'flex', marginTop: 4 }}>
            {hours.map((bucket) => (
              <div
                key={bucket.hour}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 8,
                  fontWeight: bucket.hour === peakHour ? 700 : 400,
                  color: bucket.hour === peakHour
                    ? T.accent
                    : bucket.hour % 6 === 0
                      ? T.textDim
                      : 'transparent',
                }}
              >
                {String(bucket.hour).padStart(2, '0')}
              </div>
            ))}
          </div>
          {peakHour > 0 && maxRevenue > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: T.textMid }}>
              Peak hour:{' '}
              <span style={{ color: T.accent, fontWeight: 700 }}>
                {String(peakHour).padStart(2, '0')}:00
              </span>{' '}
              · {fmt(hours[peakHour]?.revenue ?? 0)} · {hours[peakHour]?.orders ?? 0} orders
            </div>
          )}
        </div>

        {/* Middle row: order type mix + revenue by channel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Order type mix */}
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: RADIUS.card,
              padding: 20,
            }}
          >
            <SectionHeader>Order Type Mix</SectionHeader>
            {byTypeTotal === 0 ? (
              <div style={{ color: T.textDim, fontSize: 12 }}>No orders in range</div>
            ) : (
              Object.entries(summary?.byType ?? {}).map(([type, value]) => (
                <ProgressBar
                  key={type}
                  label={TYPE_LABELS[type] ?? type}
                  value={value}
                  total={byTypeTotal}
                  color={TYPE_COLORS[type] ?? T.accent}
                />
              ))
            )}
          </div>

          {/* Revenue by channel */}
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: RADIUS.card,
              padding: 20,
            }}
          >
            <SectionHeader>Revenue by Channel</SectionHeader>
            {bySourceTotal === 0 ? (
              <div style={{ color: T.textDim, fontSize: 12 }}>No orders in range</div>
            ) : (
              Object.entries(summary?.bySource ?? {})
                .sort(([, a], [, b]) => b - a)
                .map(([source, value]) => (
                  <ProgressBar
                    key={source}
                    label={SOURCE_LABELS[source] ?? source}
                    value={value}
                    total={bySourceTotal}
                    color={SOURCE_COLORS[source] ?? T.accent}
                  />
                ))
            )}
          </div>
        </div>

        {/* Commission drain */}
        {totalCommission > 0 && (
          <div
            style={{
              background: `linear-gradient(135deg, ${T.card}, rgba(201,84,84,0.08))`,
              border: `1px solid rgba(201,84,84,0.3)`,
              borderRadius: RADIUS.card,
              padding: 20,
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
                Commission Drain
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{fmt(totalCommission)}</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                {grandGross > 0 ? Math.round((totalCommission / grandGross) * 100) : 0}% of gross revenue
              </div>
            </div>
            <div style={{ width: 1, height: 48, background: T.border }} />
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Gross</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{fmtK(grandGross)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Commission</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.red }}>−{fmtK(totalCommission)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>You Keep</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.green }}>{fmtK(grandNet)}</div>
            </div>
            {/* bar */}
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ height: 10, background: T.border, borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${grandGross > 0 ? (grandNet / grandGross) * 100 : 0}%`, background: T.green, transition: 'width 0.5s' }} />
                <div style={{ flex: 1, background: T.red, opacity: 0.7 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: T.textDim }}>
                <span style={{ color: T.green }}>You keep {grandGross > 0 ? Math.round((grandNet / grandGross) * 100) : 0}%</span>
                <span style={{ color: T.red }}>Commission {grandGross > 0 ? Math.round((totalCommission / grandGross) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment method breakdown */}
        {Object.keys(summary?.byPaymentMethod ?? {}).length > 0 && (
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: RADIUS.card,
              padding: 20,
            }}
          >
            <SectionHeader>Payment Method Breakdown</SectionHeader>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(summary?.byPaymentMethod ?? {}).map(([method, value]) => {
                const color = method === 'CARD' ? T.blue : method === 'CASH' ? T.green : T.accent;
                const label = method === 'CARD' ? 'Card' : method === 'CASH' ? 'Cash' : 'Split';
                const pct = summary && summary.revenue > 0 ? Math.round((value / summary.revenue) * 100) : 0;
                return (
                  <div
                    key={method}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: RADIUS.md,
                      padding: '12px 16px',
                      minWidth: 120,
                    }}
                  >
                    <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>{fmtK(value)}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{pct}% of revenue</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom row: top items + staff performance */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Top items */}
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: RADIUS.card,
              padding: 20,
            }}
          >
            <SectionHeader>Top Items</SectionHeader>
            {(itemsData?.items ?? []).length === 0 ? (
              <div style={{ color: T.textDim, fontSize: 12 }}>No data</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(itemsData?.items ?? []).slice(0, 10).map((item, i) => (
                  <div
                    key={item.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 0',
                      borderBottom: i < 9 ? `1px solid ${T.border}` : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        background: i === 0 ? T.accentGlow : T.surface,
                        border: `1px solid ${i === 0 ? T.accent : T.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        color: i === 0 ? T.accent : T.textDim,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10, color: T.textDim }}>{item.qty} sold</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                      {fmt(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staff performance */}
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: RADIUS.card,
              padding: 20,
            }}
          >
            <SectionHeader>Staff Performance</SectionHeader>
            {(staffData?.staff ?? []).length === 0 ? (
              <div style={{ color: T.textDim, fontSize: 12 }}>No staff data for this period</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Name', 'Hrs', 'Sales', 'Labour', 'L%'].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === 'Name' ? 'left' : 'right',
                            color: T.textDim,
                            fontWeight: 700,
                            padding: '0 6px 8px',
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                            borderBottom: `1px solid ${T.border}`,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(staffData?.staff ?? []).map((row) => {
                      const labourColor =
                        row.labourCostPct > 35
                          ? T.red
                          : row.labourCostPct > 25
                            ? T.gold
                            : T.green;
                      return (
                        <tr key={row.id}>
                          <td style={{ padding: '8px 6px', borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: row.clockedIn ? T.green : T.textDim,
                                  flexShrink: 0,
                                }}
                              />
                              <div>
                                <div style={{ fontWeight: 600, color: T.text }}>{row.name}</div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: ROLE_COLORS[row.role] ?? T.textMid,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.4px',
                                  }}
                                >
                                  {row.role}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 6px', color: T.text, borderBottom: `1px solid ${T.border}` }}>
                            {row.hours.toFixed(1)}h
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 6px', color: T.accent, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>
                            {fmt(row.sales)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 6px', color: T.text, borderBottom: `1px solid ${T.border}` }}>
                            {fmt(row.labourCost)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 6px', borderBottom: `1px solid ${T.border}` }}>
                            <span
                              style={{
                                background: `${labourColor}20`,
                                color: labourColor,
                                borderRadius: 4,
                                padding: '2px 5px',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {fmtPercent(row.labourCostPct)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
