import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { T } from '@/tokens';
import { useToast } from '@/components/ui/Toast';
import { listQueued, type QueuedOrder } from '@/lib/offlineQueue';
import { flushOfflineQueue } from '@/hooks/useCreateOrder';

// Global online/offline banner. Shows a red strip across the top of the
// viewport whenever the browser is offline. When connectivity returns we
// flush any IndexedDB-queued orders and confirm with a toast.
export function OfflineIndicator() {
  const toast = useToast();
  const qc = useQueryClient();
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refreshPending = async () => {
      try {
        const q: QueuedOrder[] = await listQueued();
        if (!cancelled) setPending(q.length);
      } catch {
        /* IndexedDB unavailable — ignore */
      }
    };

    const handleOnline = async () => {
      setOnline(true);
      const { flushed } = await flushOfflineQueue();
      await refreshPending();
      qc.invalidateQueries({ queryKey: ['orders'] });
      if (flushed > 0) {
        toast.success(
          `Synced ${flushed} queued ${flushed === 1 ? 'order' : 'orders'}`,
        );
      }
    };

    const handleOffline = () => setOnline(false);

    void refreshPending();
    const interval = window.setInterval(refreshPending, 5000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, qc]);

  if (online) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: T.red,
        color: '#fff',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#fff',
          opacity: 0.9,
        }}
      />
      <span>You&rsquo;re offline. We&rsquo;ll sync as soon as you reconnect.</span>
      {pending > 0 && (
        <span
          style={{
            background: 'rgba(0,0,0,0.18)',
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {pending} {pending === 1 ? 'order' : 'orders'} queued
        </span>
      )}
    </div>
  );
}
