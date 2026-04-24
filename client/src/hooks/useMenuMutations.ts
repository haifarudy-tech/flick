import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Category, MenuItem } from '@/types/menu';

// Payload shape accepted by POST/PUT /api/v1/menu/items. All fields optional
// on update; name + basePrice required on create.
export interface ItemPayload {
  name?: string;
  categoryId?: string | null;
  description?: string;
  emoji?: string;
  basePrice?: number;
  costPrice?: number;
  isAvailable?: boolean;
  isPopular?: boolean;
  deliveryPriceUberEats?: number;
  deliveryPriceDeliveroo?: number;
  deliveryPriceJustEat?: number;
  sortOrder?: number;
}

export interface CategoryPayload {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['menu'] });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ItemPayload) =>
      api.post<MenuItem>('/api/v1/menu/items', payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ItemPayload }) =>
      api.put<MenuItem>(`/api/v1/menu/items/${id}`, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/api/v1/menu/items/${id}`),
    onSuccess: () => invalidate(qc),
  });
}

export function useToggleAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.put<MenuItem>(`/api/v1/menu/items/${id}/availability`, { isAvailable }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryPayload & { name: string }) =>
      api.post<Category>('/api/v1/menu/categories', payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryPayload }) =>
      api.put<Category>(`/api/v1/menu/categories/${id}`, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ ok: true }>(`/api/v1/menu/categories/${id}`),
    onSuccess: () => invalidate(qc),
  });
}
