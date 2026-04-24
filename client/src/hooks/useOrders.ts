import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { Order, OrdersResponse } from '@/types/order';
import type { OrderStatus } from '@flick/shared/types';

const orderKey = ['orders'] as const;

function n(v: unknown): number {
  return Number(v ?? 0);
}
function nOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return n(v);
}

// Prisma serialises Decimal as string; coerce at the boundary so everything
// downstream sees plain numbers.
function coerceOrder(raw: Record<string, unknown>): Order {
  const items = (raw.items as Record<string, unknown>[] | undefined) ?? [];
  const payments = (raw.payments as Record<string, unknown>[] | undefined) ?? [];
  return {
    ...(raw as unknown as Order),
    subtotal: n(raw.subtotal),
    discountAmount: n(raw.discountAmount),
    discountPercent: n(raw.discountPercent),
    vatAmount: n(raw.vatAmount),
    total: n(raw.total),
    platformCommissionRate: nOrNull(raw.platformCommissionRate),
    netAfterCommission: nOrNull(raw.netAfterCommission),
    deliveryFee: nOrNull(raw.deliveryFee),
    items: items.map((it) => ({
      ...(it as unknown as Order['items'][number]),
      unitPrice: n(it.unitPrice),
      totalPrice: n(it.totalPrice),
      modifiers: ((it.modifiers as Record<string, unknown>[] | undefined) ?? []).map(
        (m) => ({
          ...(m as unknown as Order['items'][number]['modifiers'][number]),
          priceAdd: n(m.priceAdd),
        }),
      ),
    })),
    payments: payments.map((p) => ({
      ...(p as unknown as Order['payments'][number]),
      amount: n(p.amount),
      tip: n(p.tip),
      change: n(p.change),
    })),
  };
}

export function useOrders() {
  return useQuery({
    queryKey: orderKey,
    queryFn: async () => {
      const res = await api.get<{ orders: unknown[] }>('/api/v1/orders?limit=200');
      return {
        orders: (res.orders as Record<string, unknown>[]).map(coerceOrder),
      } satisfies OrdersResponse;
    },
    // Kitchen/orders screens want fresh data; refetch every 30s as a backstop
    // in case sockets disconnect.
    refetchInterval: 30_000,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.put<unknown>(`/api/v1/orders/${id}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKey });
    },
  });
}

// Subscribe to order-related socket events and patch the React Query cache.
// Meant to be called once near the top of the Orders / Kitchen screens.
export function useOrderSocket(opts: { onNewOrder?: (order: Order) => void } = {}) {
  const qc = useQueryClient();
  const { onNewOrder } = opts;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join:orders');
    socket.emit('join:kitchen');

    const patchList = (updater: (orders: Order[]) => Order[]) => {
      qc.setQueryData<OrdersResponse>(orderKey, (prev) => {
        if (!prev) return prev;
        return { orders: updater(prev.orders) };
      });
    };

    const onNew = (raw: unknown) => {
      const order = coerceOrder(raw as Record<string, unknown>);
      patchList((orders) => {
        const idx = orders.findIndex((o) => o.id === order.id);
        if (idx >= 0) {
          const next = orders.slice();
          next[idx] = order;
          return next;
        }
        return [order, ...orders];
      });
      onNewOrder?.(order);
    };

    const onUpdated = (raw: unknown) => {
      const order = coerceOrder(raw as Record<string, unknown>);
      patchList((orders) => {
        const idx = orders.findIndex((o) => o.id === order.id);
        if (idx < 0) return [order, ...orders];
        const next = orders.slice();
        next[idx] = { ...next[idx], ...order };
        return next;
      });
    };

    const onCancelled = (raw: unknown) => {
      const payload = raw as { orderId?: string };
      if (!payload?.orderId) return;
      patchList((orders) =>
        orders.map((o) =>
          o.id === payload.orderId ? { ...o, status: 'CANCELLED' } : o,
        ),
      );
    };

    socket.on('order:new', onNew);
    socket.on('platform:order', onNew);
    socket.on('order:updated', onUpdated);
    socket.on('order:cancelled', onCancelled);

    return () => {
      socket.off('order:new', onNew);
      socket.off('platform:order', onNew);
      socket.off('order:updated', onUpdated);
      socket.off('order:cancelled', onCancelled);
    };
  }, [qc, onNewOrder]);
}
