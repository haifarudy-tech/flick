import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { StaffListResponse, TimesheetResponse } from '@/types/staff';

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<StaffListResponse>('/api/v1/staff'),
  });
}

export function useTimesheet(date: string) {
  return useQuery({
    queryKey: ['staff', 'timesheet', date],
    queryFn: () => api.get<TimesheetResponse>(`/api/v1/staff/timesheet?date=${date}`),
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      password: string;
      role: string;
      pin?: string;
      hourlyRate?: number;
    }) => api.post('/api/v1/staff', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.put(`/api/v1/staff/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/staff/${id}/clock-in`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/staff/${id}/clock-out`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

// Invalidates staff + timesheet queries when server emits staff:updated
export function useStaffSocket() {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
    };
    socket.on('staff:updated', handler);
    return () => {
      socket.off('staff:updated', handler);
    };
  }, [qc]);
}
