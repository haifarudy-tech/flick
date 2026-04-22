import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { enqueue, listQueued, removeQueued, type QueuedOrder } from '@/lib/offlineQueue';

export interface CreateOrderPayload {
  type: QueuedOrder['payload']['type'];
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  discountAmount: number;
  discountPercent: number;
  notes?: string;
  items: QueuedOrder['payload']['items'];
}

export interface CreateOrderResult {
  queued: boolean;
  id: string;
}

// Try to POST the order. If the network fails or server 5xx, queue it.
async function sendOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  try {
    const order = await api.post<{ id: string }>('/api/v1/orders', payload);
    return { queued: false, id: order.id };
  } catch (err) {
    // Only queue on network / 5xx. 4xx is a validation error — surface it.
    const isServerOrNetwork =
      !(err instanceof ApiError) || (err.status >= 500 && err.status < 600);
    if (!isServerOrNetwork) throw err;

    const queued: QueuedOrder = {
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      payload,
      attempts: 0,
      lastError: err instanceof Error ? err.message : 'Network unavailable',
    };
    await enqueue(queued);
    return { queued: true, id: queued.id };
  }
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// Flush any queued orders that accumulated offline. Safe to call repeatedly —
// items are removed once successfully sent.
export async function flushOfflineQueue(): Promise<{ flushed: number; failed: number }> {
  const queued = await listQueued();
  let flushed = 0;
  let failed = 0;
  for (const q of queued) {
    try {
      await api.post('/api/v1/orders', q.payload);
      await removeQueued(q.id);
      flushed += 1;
    } catch (err) {
      // If the server rejected (4xx), the payload is invalid — drop it so the
      // queue doesn't wedge. For transient (5xx / network) keep it around.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        await removeQueued(q.id);
        failed += 1;
        continue;
      }
      failed += 1;
    }
  }
  return { flushed, failed };
}

// Hook that flushes on mount, on reconnect, and whenever the tab regains focus.
export function useOfflineFlusher() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      const q = await listQueued();
      if (!cancelled) setPending(q.length);
    };

    const flush = async () => {
      await flushOfflineQueue();
      await refresh();
      qc.invalidateQueries({ queryKey: ['orders'] });
    };

    void refresh();
    if (navigator.onLine) void flush();

    window.addEventListener('online', flush);
    window.addEventListener('focus', flush);
    const interval = window.setInterval(() => {
      if (navigator.onLine) void flush();
      else void refresh();
    }, 20_000);

    return () => {
      cancelled = true;
      window.removeEventListener('online', flush);
      window.removeEventListener('focus', flush);
      window.clearInterval(interval);
    };
  }, [qc]);

  return { pending };
}
