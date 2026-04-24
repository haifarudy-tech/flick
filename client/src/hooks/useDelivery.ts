import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  DeliveryPlatformConnection,
  PlatformsResponse,
} from '@/types/delivery';
import type { DeliveryPlatform } from '@flick/shared/types';

const platformsKey = ['delivery', 'platforms'] as const;

function toApiKey(platform: DeliveryPlatform): 'ubereats' | 'deliveroo' | 'justeat' {
  switch (platform) {
    case 'UBER_EATS':
      return 'ubereats';
    case 'DELIVEROO':
      return 'deliveroo';
    case 'JUST_EAT':
      return 'justeat';
  }
}

function coerceConnection(raw: Record<string, unknown>): DeliveryPlatformConnection {
  return {
    ...(raw as unknown as DeliveryPlatformConnection),
    commissionRate: Number(raw.commissionRate ?? 0),
    deliveryPricingMarkupPct: Number(raw.deliveryPricingMarkupPct ?? 0),
  };
}

export function useDeliveryPlatforms() {
  return useQuery({
    queryKey: platformsKey,
    queryFn: async () => {
      const res = await api.get<{ platforms: unknown[] }>('/api/v1/delivery/platforms');
      return {
        platforms: (res.platforms as Record<string, unknown>[]).map(coerceConnection),
      } satisfies PlatformsResponse;
    },
    staleTime: 15_000,
  });
}

export function useStartConnect() {
  return useMutation({
    mutationFn: async (platform: DeliveryPlatform) => {
      const key = toApiKey(platform);
      return api.post<{ url: string; state: string }>(
        `/api/v1/delivery/connect/${key}`,
      );
    },
  });
}

export function useFinishConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      platform: DeliveryPlatform;
      code: string;
      state: string;
      externalLocationId: string;
    }) => {
      const key = toApiKey(input.platform);
      return api.post<DeliveryPlatformConnection>(
        `/api/v1/delivery/callback/${key}`,
        {
          code: input.code,
          state: input.state,
          externalLocationId: input.externalLocationId,
        },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformsKey });
    },
  });
}

export function useDisconnectPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (platform: DeliveryPlatform) => {
      const key = toApiKey(platform);
      return api.delete<{ ok: boolean }>(`/api/v1/delivery/disconnect/${key}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformsKey });
    },
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (platform: DeliveryPlatform) => {
      const key = toApiKey(platform);
      return api.post<{ queued: boolean }>(`/api/v1/delivery/sync/${key}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformsKey });
    },
  });
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      platform: DeliveryPlatform;
      commissionRate?: number;
      menuSyncEnabled?: boolean;
      autoAcceptOrders?: boolean;
      deliveryPricingMarkupPct?: number;
    }) => {
      const { platform, ...body } = input;
      const key = toApiKey(platform);
      return api.put<DeliveryPlatformConnection>(
        `/api/v1/delivery/settings/${key}`,
        body,
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformsKey });
    },
  });
}
