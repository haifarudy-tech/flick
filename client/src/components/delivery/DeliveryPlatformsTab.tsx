import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { fmt } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import {
  useDisconnectPlatform,
  useStartConnect,
  useTriggerSync,
} from '@/hooks/useDelivery';
import type { DeliveryPlatformConnection } from '@/types/delivery';
import { DELIVERY_PLATFORMS } from '@/types/delivery';
import type { Order } from '@/types/order';
import type { DeliveryPlatform } from '@flick/shared/types';
import { planMeets, PLAN_LIMITS } from '@flick/shared/types';
import { useAuthStore } from '@/stores/auth';
import { UpgradeModal } from '@/components/UpgradeModal';

export function DeliveryPlatformsTab({
  todayOrders,
  platforms,
}: {
  todayOrders: Order[];
  platforms: DeliveryPlatformConnection[];
}) {
  const plan = useAuthStore((s) => s.business?.plan ?? 'FREE');
  const connectedCount = platforms.filter((p) => p.status === 'CONNECTED').length;
  const platformAllowance = PLAN_LIMITS[plan].deliveryPlatforms;

  return (
    <div
      style={{
        padding: 20,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 14,
      }}
    >
      {DELIVERY_PLATFORMS.map((meta) => {
        const conn =
          meta.key === 'DIRECT_QR'
            ? null
            : platforms.find((p) => p.platform === (meta.key as DeliveryPlatform));
        const ordersForThis = todayOrders.filter((o) => o.source === meta.key);
        const gross = ordersForThis.reduce((s, o) => s + o.total, 0);
        const net = ordersForThis.reduce(
          (s, o) => s + (o.netAfterCommission ?? o.total),
          0,
        );
        // Can connect: plan allows platforms AND haven't hit the limit yet (or already connected)
        const alreadyConnected = conn?.status === 'CONNECTED';
        const canConnect =
          meta.key === 'DIRECT_QR' ||
          alreadyConnected ||
          (planMeets(plan, 'STARTER') && connectedCount < platformAllowance);
        // PRO required for Just Eat (3rd platform slot)
        const requiresPro = meta.key === 'JUST_EAT' && !planMeets(plan, 'PRO');

        return (
          <PlatformCard
            key={meta.key}
            meta={meta}
            conn={conn}
            orderCount={ordersForThis.length}
            gross={gross}
            net={net}
            canConnect={canConnect && !requiresPro}
            upgradeRequired={
              !planMeets(plan, 'STARTER')
                ? 'STARTER'
                : requiresPro
                ? 'PRO'
                : connectedCount >= platformAllowance && !alreadyConnected
                ? 'PRO'
                : null
            }
          />
        );
      })}
    </div>
  );
}

function PlatformCard({
  meta,
  conn,
  orderCount,
  gross,
  net,
  canConnect,
  upgradeRequired,
}: {
  meta: (typeof DELIVERY_PLATFORMS)[number];
  conn: DeliveryPlatformConnection | null | undefined;
  orderCount: number;
  gross: number;
  net: number;
  canConnect?: boolean;
  upgradeRequired?: 'STARTER' | 'PRO' | null;
}) {
  const isDirectQr = meta.key === 'DIRECT_QR';
  const connected = isDirectQr || conn?.status === 'CONNECTED';
  const commissionPct = isDirectQr
    ? 0
    : conn?.commissionRate ?? meta.defaultCommissionPct;
  const startConnect = useStartConnect();
  const disconnect = useDisconnectPlatform();
  const triggerSync = useTriggerSync();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleConnect = async () => {
    if (!meta.apiKey) return;
    try {
      setBusy(true);
      const res = await startConnect.mutateAsync(meta.key as DeliveryPlatform);
      window.location.href = res.url;
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not start connection',
      );
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!meta.apiKey) return;
    if (!confirm(`Disconnect ${meta.label}?`)) return;
    try {
      await disconnect.mutateAsync(meta.key as DeliveryPlatform);
      toast.success(`${meta.label} disconnected`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not disconnect');
    }
  };

  const handleSync = async () => {
    if (!meta.apiKey) return;
    try {
      await triggerSync.mutateAsync(meta.key as DeliveryPlatform);
      toast.success(`Menu sync queued for ${meta.label}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sync');
    }
  };

  const youKeepPct = gross > 0 ? (net / gross) * 100 : 100 - commissionPct;

  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${connected ? `${meta.brandColor}40` : T.border}`,
        borderRadius: 16,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `${meta.brandColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            {meta.icon}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{meta.label}</div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: connected ? T.green : T.textDim,
              }}
            >
              {connected ? '● Connected' : '○ Disconnected'}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 20,
            background: commissionPct === 0 ? `${T.green}20` : `${T.red}20`,
            color: commissionPct === 0 ? T.green : T.red,
            border: `1px solid ${commissionPct === 0 ? T.green : T.red}40`,
          }}
        >
          {commissionPct}% comm
        </span>
      </div>

      {/* Today metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        <Metric label="Orders" value={String(orderCount)} />
        <Metric label="Gross" value={fmt(gross)} />
        <Metric label="Net" value={fmt(net)} color={T.green} />
      </div>

      {/* Commission drain bar: green = you keep, red = lost to platform */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: T.textDim,
            fontWeight: 700,
            marginBottom: 6,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          <span>You keep {Math.round(youKeepPct)}%</span>
          <span>Lost {Math.round(100 - youKeepPct)}%</span>
        </div>
        <div
          style={{
            display: 'flex',
            height: 8,
            borderRadius: 8,
            overflow: 'hidden',
            background: T.bg,
          }}
        >
          <div
            style={{
              width: `${youKeepPct}%`,
              background: T.green,
            }}
          />
          <div
            style={{
              width: `${100 - youKeepPct}%`,
              background: T.red,
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {isDirectQr ? (
          <button
            type="button"
            disabled
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              background: `${T.green}15`,
              border: `1px solid ${T.green}50`,
              color: T.green,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'inherit',
              cursor: 'default',
            }}
          >
            Always on · 0% commission
          </button>
        ) : connected ? (
          <>
            <button
              type="button"
              onClick={handleSync}
              disabled={triggerSync.isPending}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                background: `${T.accent}15`,
                border: `1px solid ${T.accent}50`,
                color: T.accent,
                fontSize: 12,
                fontWeight: 800,
                cursor: triggerSync.isPending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sync menu
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'transparent',
                border: `1px solid ${T.border}`,
                color: T.textMid,
                fontSize: 12,
                fontWeight: 700,
                cursor: disconnect.isPending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Disconnect
            </button>
          </>
        ) : upgradeRequired ? (
          <button
            type="button"
            onClick={() => setShowUpgrade(true)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              background: 'transparent',
              border: `1px dashed ${T.border}`,
              color: T.textMid,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🔒 {upgradeRequired}+ required
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy || startConnect.isPending || canConnect === false}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              background: meta.brandColor,
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.6 : 1,
            }}
          >
            Connect {meta.label} →
          </button>
        )}
      </div>

      {conn?.lastSyncAt && (
        <div style={{ fontSize: 10, color: T.textDim, textAlign: 'center' }}>
          Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
        </div>
      )}

      {showUpgrade && upgradeRequired && (
        <UpgradeModal
          feature={`Connect ${meta.label}`}
          description={`Integrate ${meta.label} orders directly into Flick. Orders appear automatically — no separate tablet needed.`}
          required={upgradeRequired}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}

function Metric({
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
        background: T.bg,
        borderRadius: 10,
        padding: '8px 10px',
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: T.textDim,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: color ?? T.text,
        }}
        className="num"
      >
        {value}
      </div>
    </div>
  );
}
