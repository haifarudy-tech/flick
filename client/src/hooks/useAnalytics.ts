import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type {
  AnalyticsSummary,
  HourlyResponse,
  TopItemsResponse,
  StaffPerfResponse,
  DeliveryBreakdownResponse,
} from '@/types/analytics';

function qs(from: Date, to: Date) {
  return `from=${from.toISOString()}&to=${to.toISOString()}`;
}

export function useAnalyticsSummary(from: Date, to: Date) {
  return useQuery({
    queryKey: ['analytics', 'summary', from.toISOString(), to.toISOString()],
    queryFn: () => api.get<AnalyticsSummary>(`/api/v1/analytics/summary?${qs(from, to)}`),
  });
}

export function useAnalyticsHourly(from: Date, to: Date) {
  return useQuery({
    queryKey: ['analytics', 'hourly', from.toISOString(), to.toISOString()],
    queryFn: () => api.get<HourlyResponse>(`/api/v1/analytics/hourly?${qs(from, to)}`),
  });
}

export function useTopItems(from: Date, to: Date) {
  return useQuery({
    queryKey: ['analytics', 'items', from.toISOString(), to.toISOString()],
    queryFn: () => api.get<TopItemsResponse>(`/api/v1/analytics/items?${qs(from, to)}`),
  });
}

export function useStaffPerformance(from: Date, to: Date) {
  return useQuery({
    queryKey: ['analytics', 'staff', from.toISOString(), to.toISOString()],
    queryFn: () => api.get<StaffPerfResponse>(`/api/v1/analytics/staff?${qs(from, to)}`),
  });
}

export function useDeliveryBreakdown(from: Date, to: Date) {
  return useQuery({
    queryKey: ['analytics', 'delivery', from.toISOString(), to.toISOString()],
    queryFn: () =>
      api.get<DeliveryBreakdownResponse>(`/api/v1/analytics/delivery?${qs(from, to)}`),
  });
}

// Invalidate all analytics queries whenever an order event fires so the
// dashboard stays live without polling.
export function useAnalyticsSocket(from: Date, to: Date) {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ['analytics'] });
    };
    socket.on('order:new', refresh);
    socket.on('order:updated', refresh);
    socket.on('order:cancelled', refresh);
    return () => {
      socket.off('order:new', refresh);
      socket.off('order:updated', refresh);
      socket.off('order:cancelled', refresh);
    };
  }, [qc, from, to]);
}
