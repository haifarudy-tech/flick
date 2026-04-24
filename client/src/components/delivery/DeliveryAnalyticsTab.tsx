import { useMemo } from 'react';
import { T } from '@/tokens';
import { fmt } from '@/lib/format';
import { DELIVERY_PLATFORMS } from '@/types/delivery';
import type { DeliveryPlatformConnection } from '@/types/delivery';
import type { Order } from '@/types/order';
import type { OrderSource } from '@flick/shared/types';

interface PlatformStats {
  key: OrderSource;
  label: string;
  brandColor: string;
  orders: number;
  gross: number;
  net: number;
  commission: number;
}

export function DeliveryAnalyticsTab({
  todayOrders,
  platforms,
}: {
  todayOrders: Order[];
  platforms: DeliveryPlatformConnection[];
}) {
  const stats = useMemo<PlatformStats[]>(() => {
    return DELIVERY_PLATFORMS.map((meta) => {
      const orders = todayOrders.filter((o) => o.source === meta.key);
      const gross = orders.reduce((s, o) => s + o.total, 0);
      const net = orders.reduce(
        (s, o) => s + (o.netAfterCommission ?? o.total),
        0,
      );
      return {
        key: meta.key,
        label: meta.label,
        brandColor: meta.brandColor,
        orders: orders.length,
        gross,
        net,
        commission: gross - net,
      };
    });
  }, [todayOrders]);

  const totalCommission = stats.reduce((s, p) => s + p.commission, 0);
  const totalGross = stats.reduce((s, p) => s + p.gross, 0);
  const totalNet = stats.reduce((s, p) => s + p.net, 0);
  const maxGross = Math.max(...stats.map((s) => s.gross), 1);

  const directQrOrders = stats.find((s) => s.key === 'DIRECT_QR')?.orders ?? 0;
  const thirdPartyGross = stats
    .filter((s) => s.key !== 'DIRECT_QR')
    .reduce((sum, s) => sum + s.gross, 0);
  // Savings if the average third-party order came via Direct QR instead.
  const avgCommissionPct =
    thirdPartyGross > 0 ? (totalCommission / thirdPartyGross) * 100 : 0;
  const projectedMonthlySavings = totalCommission * 30; // rough, based on today

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Commission Drain callout */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.red}15, ${T.card})`,
          border: `1px solid ${T.red}40`,
          borderRadius: 16,
          padding: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: `${T.red}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}
        >
          💸
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: T.red,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            Commission drain · Today
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: T.red,
              marginTop: 2,
              letterSpacing: '-0.5px',
            }}
            className="num"
          >
            −{fmt(totalCommission)}
          </div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>
            Lost to third-party platforms · avg {avgCommissionPct.toFixed(0)}%
            commission
          </div>
        </div>
      </div>

      {/* Revenue by Platform chart */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
          Revenue by Platform
        </div>
        {totalGross === 0 ? (
          <div style={{ fontSize: 12, color: T.textDim, padding: 20, textAlign: 'center' }}>
            No revenue yet today.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.map((s) => {
              const pct = (s.gross / maxGross) * 100;
              const netPct = s.gross > 0 ? (s.net / s.gross) * 100 : 100;
              return (
                <div key={s.key}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        color: T.text,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: s.brandColor,
                        }}
                      />
                      {s.label}
                    </span>
                    <span style={{ color: T.textMid }} className="num">
                      {fmt(s.gross)}{' '}
                      <span style={{ color: T.green }}>
                        (net {fmt(s.net)})
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: 10,
                      width: `${Math.max(pct, 2)}%`,
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: T.bg,
                    }}
                  >
                    <div
                      style={{
                        width: `${netPct}%`,
                        background: s.brandColor,
                      }}
                    />
                    <div
                      style={{
                        width: `${100 - netPct}%`,
                        background: T.red,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grow your Direct channel recommendation */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.green}15, ${T.card})`,
          border: `1px solid ${T.green}40`,
          borderRadius: 16,
          padding: 18,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: `${T.green}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}
        >
          📈
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: T.green,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            Grow your Direct channel
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: T.text }}>
            If your {stats.find((s) => s.key !== 'DIRECT_QR' && s.orders > 0)?.label ?? 'third-party'}{' '}
            volume moved to Direct QR, you'd save roughly{' '}
            <span style={{ color: T.green, fontWeight: 900 }} className="num">
              {fmt(projectedMonthlySavings)}
            </span>{' '}
            per month.
          </div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>
            {directQrOrders} direct orders today · 0% commission vs avg{' '}
            {avgCommissionPct.toFixed(0)}% platform fee
          </div>
        </div>
      </div>

      {/* Order mix cards per platform */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        {stats.map((s) => {
          const share = totalGross > 0 ? (s.gross / totalGross) * 100 : 0;
          return (
            <div
              key={s.key}
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderLeft: `3px solid ${s.brandColor}`,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: T.textDim,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  marginTop: 6,
                  letterSpacing: '-0.3px',
                }}
                className="num"
              >
                {s.orders} orders
              </div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
                {share.toFixed(0)}% of mix · {fmt(s.gross)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}
      >
        <SummaryBox label="Total gross" value={fmt(totalGross)} />
        <SummaryBox
          label="Total commission"
          value={`−${fmt(totalCommission)}`}
          color={T.red}
        />
        <SummaryBox label="You kept" value={fmt(totalNet)} color={T.green} />
      </div>

      {/* Connection status summary */}
      <div
        style={{
          fontSize: 11,
          color: T.textDim,
          textAlign: 'center',
        }}
      >
        {platforms.filter((p) => p.status === 'CONNECTED').length} platform
        {platforms.filter((p) => p.status === 'CONNECTED').length === 1 ? '' : 's'}{' '}
        currently connected
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
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
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: color ?? T.text,
          marginTop: 6,
        }}
        className="num"
      >
        {value}
      </div>
    </div>
  );
}
