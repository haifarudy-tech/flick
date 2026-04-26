import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T } from '@/tokens';
import { useOrders, useOrderSocket, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { Order } from '@/types/order';
import { PLATFORM_META } from '@/types/order';
import type { OrderStatus } from '@flick/shared/types';
import { planMeets } from '@flick/shared/types';
import { useAuthStore } from '@/stores/auth';
import { PlanLockOverlay } from '@/components/UpgradeModal';

interface KitchenColumn {
  key: 'cooking' | 'ready';
  label: string;
  color: string;
  matches: OrderStatus[];
  next: OrderStatus;
}

const COLUMNS: KitchenColumn[] = [
  {
    key: 'cooking',
    label: 'Cooking',
    color: T.gold,
    matches: ['NEW', 'PREPARING'],
    next: 'READY',
  },
  {
    key: 'ready',
    label: 'Ready to Serve',
    color: T.green,
    matches: ['READY'],
    next: 'COMPLETED',
  },
];

function elapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min';
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function elapsedColor(iso: string): string {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins > 15) return T.red;
  if (mins > 8) return T.gold;
  return T.textDim;
}

export function KitchenPage() {
  const plan = useAuthStore((s) => s.business?.plan ?? 'FREE');

  if (!planMeets(plan, 'PRO')) {
    return (
      <PlanLockOverlay
        feature="Kitchen Display System"
        description="The KDS shows live orders to your kitchen team in a clear two-column layout — cooking and ready — with elapsed time warnings so nothing goes cold."
        required="PRO"
      />
    );
  }

  return <KitchenPageInner />;
}

function KitchenPageInner() {
  const { data, isLoading } = useOrders();
  const toast = useToast();
  const updateStatus = useUpdateOrderStatus();

  // Per-order map of bumped item ids (client-only — the schema has no
  // per-item status field yet). A re-mount clears it, which is fine.
  const [bumpedItems, setBumpedItems] = useState<Record<string, Set<string>>>({});

  // Tick once a minute so the elapsed counters refresh live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // New-order flash + ding, same pattern as Orders but more prominent.
  const seenIds = useRef<Set<string>>(new Set());
  const onNewOrder = useCallback(
    (order: Order) => {
      if (seenIds.current.has(order.id)) return;
      seenIds.current.add(order.id);
      const plat = PLATFORM_META[order.source];
      toast.info(`${plat.label} · Order #${order.orderNumber}`);
    },
    [toast],
  );
  useOrderSocket({ onNewOrder });

  const orders = data?.orders ?? [];
  const active = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'NEW' || o.status === 'PREPARING' || o.status === 'READY',
      ),
    [orders],
  );

  const byCol = useMemo(() => {
    const map = new Map<KitchenColumn['key'], Order[]>();
    COLUMNS.forEach((c) => map.set(c.key, []));
    for (const o of active) {
      const col = COLUMNS.find((c) => c.matches.includes(o.status));
      if (col) map.get(col.key)?.push(o);
    }
    // Oldest first — the chef should finish the ones that have been
    // waiting longest first.
    for (const col of COLUMNS) {
      map
        .get(col.key)
        ?.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return map;
  }, [active]);

  const bumpOrder = async (order: Order, next: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id: order.id, status: next });
      setBumpedItems((m) => {
        const copy = { ...m };
        delete copy[order.id];
        return copy;
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not bump');
    }
  };

  const toggleItem = (order: Order, itemId: string, next: OrderStatus) => {
    setBumpedItems((m) => {
      const set = new Set(m[order.id] ?? []);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      const nextMap = { ...m, [order.id]: set };
      // If every item on this order is bumped, auto-advance the order.
      if (set.size === order.items.length) {
        void bumpOrder(order, next);
      }
      return nextMap;
    });
  };

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: T.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.3px' }}>
            🍳 Kitchen Display
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: T.textDim }}>
            {byCol.get('cooking')?.length ?? 0} cooking · {byCol.get('ready')?.length ?? 0} ready ·
            live
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={requestFullscreen}
            style={{
              padding: '8px 16px',
              background: T.card,
              border: `1px solid ${T.border}`,
              color: T.textMid,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ⛶ Full screen
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(78,168,107,0.12)',
              padding: '8px 14px',
              borderRadius: 20,
              border: `1px solid ${T.green}30`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: T.green,
                boxShadow: `0 0 8px ${T.green}`,
              }}
            />
            <span style={{ color: T.green, fontSize: 14, fontWeight: 800 }}>LIVE</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
        {isLoading && (
          <div style={{ padding: 60, textAlign: 'center', color: T.textDim, fontSize: 18 }}>
            Loading kitchen…
          </div>
        )}
        {!isLoading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 18,
              minWidth: 880,
            }}
          >
            {COLUMNS.map((col) => {
              const list = byCol.get(col.key) ?? [];
              return (
                <div key={col.key}>
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
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: col.color,
                        boxShadow: `0 0 10px ${col.color}`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {col.label}
                    </span>
                    <span
                      style={{
                        background: col.color + '20',
                        border: `1px solid ${col.color}40`,
                        color: col.color,
                        borderRadius: 20,
                        padding: '2px 12px',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {list.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {list.length === 0 ? (
                      <div
                        style={{
                          border: `2px dashed ${T.border}`,
                          borderRadius: 16,
                          padding: 40,
                          textAlign: 'center',
                          color: T.textDim,
                          fontSize: 16,
                          fontWeight: 600,
                        }}
                      >
                        {col.key === 'cooking' ? 'All caught up 🎉' : 'Nothing ready yet'}
                      </div>
                    ) : (
                      list.map((o) => (
                        <KitchenCard
                          key={o.id}
                          order={o}
                          col={col}
                          bumped={bumpedItems[o.id] ?? new Set<string>()}
                          onToggleItem={(itemId) => toggleItem(o, itemId, col.next)}
                          onBumpOrder={() => bumpOrder(o, col.next)}
                          bumping={
                            updateStatus.isPending &&
                            updateStatus.variables?.id === o.id
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KitchenCard({
  order,
  col,
  bumped,
  onToggleItem,
  onBumpOrder,
  bumping,
}: {
  order: Order;
  col: KitchenColumn;
  bumped: Set<string>;
  onToggleItem: (itemId: string) => void;
  onBumpOrder: () => void;
  bumping: boolean;
}) {
  const plat = PLATFORM_META[order.source];
  const tableOrSource =
    order.type === 'DINE_IN' && order.tableNumber
      ? `Table ${order.tableNumber}`
      : order.type === 'DELIVERY'
        ? plat.label
        : 'Takeaway';
  const elapsedText = elapsed(order.createdAt);
  const elapsedC = elapsedColor(order.createdAt);

  return (
    <div
      style={{
        background: T.card,
        border: `2px solid ${T.border}`,
        borderLeft: `6px solid ${plat.color}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 22 }}>{plat.icon}</span>
            <span style={{ fontWeight: 900, fontSize: 28, letterSpacing: '-0.4px' }}>
              #{order.orderNumber}
            </span>
          </div>
          <div
            style={{
              fontSize: 18,
              color: T.accent,
              fontWeight: 800,
              marginTop: 4,
            }}
          >
            {tableOrSource}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: elapsedC, fontWeight: 800 }}>
            ⏱ {elapsedText}
          </div>
          {order.notes && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: T.gold,
                fontWeight: 700,
                padding: '3px 8px',
                background: 'rgba(200,153,58,0.12)',
                borderRadius: 6,
                maxWidth: 200,
              }}
            >
              ✎ {order.notes}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {order.items.map((it) => {
          const done = bumped.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggleItem(it.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: done ? 'rgba(78,168,107,0.1)' : T.bg,
                border: `1px solid ${done ? T.green + '40' : T.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                width: '100%',
                transition: 'all 0.15s',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: done ? T.green : T.accent,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {done ? '✓' : `${it.quantity}×`}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: done ? T.textMid : T.text,
                    textDecoration: done ? 'line-through' : 'none',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {it.name}
                </div>
                {it.modifiers.length > 0 && (
                  <div
                    style={{
                      fontSize: 13,
                      color: T.textMid,
                      marginTop: 2,
                      fontWeight: 600,
                    }}
                  >
                    {it.modifiers.map((m) => m.modifierName).join(' · ')}
                  </div>
                )}
                {it.notes && (
                  <div
                    style={{
                      fontSize: 13,
                      color: T.gold,
                      marginTop: 4,
                      fontWeight: 700,
                    }}
                  >
                    ✎ {it.notes}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onBumpOrder}
        disabled={bumping}
        style={{
          width: '100%',
          padding: '16px',
          background:
            col.key === 'cooking'
              ? `linear-gradient(135deg, ${T.gold}, ${T.accent})`
              : `linear-gradient(135deg, ${T.green}, #3F8C57)`,
          border: 'none',
          color: '#fff',
          borderRadius: 12,
          cursor: bumping ? 'wait' : 'pointer',
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          fontFamily: 'inherit',
          boxShadow: `0 4px 16px ${col.color}40`,
          opacity: bumping ? 0.6 : 1,
          transition: 'all 0.15s',
        }}
      >
        {col.key === 'cooking' ? 'Mark Ready →' : 'Served ✓'}
      </button>
    </div>
  );
}
