import { useState, useEffect } from 'react';
import { T } from '@/tokens';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import {
  useDisconnectPlatform,
  useUpdatePlatformSettings,
} from '@/hooks/useDelivery';
import type { DeliveryPlatformConnection } from '@/types/delivery';
import { DELIVERY_PLATFORMS } from '@/types/delivery';
import type { DeliveryPlatform } from '@flick/shared/types';

export function DeliverySettingsTab({
  platforms,
}: {
  platforms: DeliveryPlatformConnection[];
}) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          fontSize: 11,
          color: T.textDim,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
        }}
      >
        Platform-level settings
      </div>
      {DELIVERY_PLATFORMS.filter((m) => m.apiKey).map((meta) => {
        const conn = platforms.find(
          (p) => p.platform === (meta.key as DeliveryPlatform),
        );
        return <PlatformSettingsCard key={meta.key} meta={meta} conn={conn} />;
      })}
      <div
        style={{
          background: T.card,
          border: `1px dashed ${T.border}`,
          borderRadius: 14,
          padding: 14,
          fontSize: 12,
          color: T.textMid,
        }}
      >
        <strong style={{ color: T.text }}>📱 Direct QR</strong> — always on,
        zero commission. Manage QR menu settings from the{' '}
        <em>Menu Manager</em>.
      </div>
    </div>
  );
}

function PlatformSettingsCard({
  meta,
  conn,
}: {
  meta: (typeof DELIVERY_PLATFORMS)[number];
  conn: DeliveryPlatformConnection | undefined;
}) {
  const toast = useToast();
  const update = useUpdatePlatformSettings();
  const disconnect = useDisconnectPlatform();
  const platformEnum = meta.key as DeliveryPlatform;
  const connected = conn?.status === 'CONNECTED';

  // Local state mirrors server values so sliders / toggles feel instant.
  // Reset when the backing connection changes.
  const [menuSync, setMenuSync] = useState(conn?.menuSyncEnabled ?? true);
  const [autoAccept, setAutoAccept] = useState(conn?.autoAcceptOrders ?? false);
  const [markup, setMarkup] = useState(conn?.deliveryPricingMarkupPct ?? 0);

  useEffect(() => {
    if (!conn) return;
    setMenuSync(conn.menuSyncEnabled);
    setAutoAccept(conn.autoAcceptOrders);
    setMarkup(conn.deliveryPricingMarkupPct);
  }, [conn]);

  const disabled = !connected;

  const patch = async (body: {
    menuSyncEnabled?: boolean;
    autoAcceptOrders?: boolean;
    deliveryPricingMarkupPct?: number;
  }) => {
    try {
      await update.mutateAsync({ platform: platformEnum, ...body });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not update settings',
      );
    }
  };

  const pause = async () => {
    if (!connected) return;
    if (!confirm(`Pause ${meta.label}? Orders will stop coming through until you resume.`)) {
      return;
    }
    try {
      await disconnect.mutateAsync(platformEnum);
      toast.success(`${meta.label} paused`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not pause');
    }
  };

  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 16,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${meta.brandColor}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{meta.label}</div>
          <div
            style={{
              fontSize: 10,
              color: connected ? T.green : T.textDim,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
            }}
          >
            {connected ? '● Active' : '○ Not connected'}
          </div>
        </div>
        <button
          type="button"
          onClick={pause}
          disabled={!connected}
          style={{
            padding: '7px 13px',
            borderRadius: 20,
            background: 'transparent',
            border: `1px solid ${T.border}`,
            color: T.textMid,
            fontSize: 11,
            fontWeight: 700,
            cursor: connected ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          Pause
        </button>
      </div>

      <SettingRow
        label="Menu sync"
        help="Push menu changes to this platform automatically."
      >
        <Toggle
          on={menuSync}
          onChange={() => {
            if (disabled) return;
            const next = !menuSync;
            setMenuSync(next);
            void patch({ menuSyncEnabled: next });
          }}
        />
      </SettingRow>

      <SettingRow
        label="Auto-accept orders"
        help="Skip the New column and start new orders in Preparing."
      >
        <Toggle
          on={autoAccept}
          onChange={() => {
            if (disabled) return;
            const next = !autoAccept;
            setAutoAccept(next);
            void patch({ autoAcceptOrders: next });
          }}
        />
      </SettingRow>

      <SettingRow
        label="Delivery pricing markup"
        help={`Add ${markup}% to base prices when syncing to ${meta.label} to absorb commission.`}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: 200,
          }}
        >
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={markup}
            onChange={(e) => setMarkup(Number(e.target.value))}
            onMouseUp={() =>
              !disabled && void patch({ deliveryPricingMarkupPct: markup })
            }
            onTouchEnd={() =>
              !disabled && void patch({ deliveryPricingMarkupPct: markup })
            }
            disabled={disabled}
            style={{ flex: 1, accentColor: T.accent }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: T.accent,
              minWidth: 40,
              textAlign: 'right',
            }}
            className="num"
          >
            +{markup}%
          </span>
        </div>
      </SettingRow>
    </div>
  );
}

function SettingRow({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderTop: `1px solid ${T.border}`,
        gap: 14,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{help}</div>
      </div>
      {children}
    </div>
  );
}
