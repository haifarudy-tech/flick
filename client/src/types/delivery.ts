import type { DeliveryPlatform, PlatformConnectionStatus } from '@flick/shared/types';
import type { OrderSource } from '@flick/shared/types';

export interface DeliveryPlatformConnection {
  id: string;
  platform: DeliveryPlatform;
  status: PlatformConnectionStatus;
  commissionRate: number;
  menuSyncEnabled: boolean;
  autoAcceptOrders: boolean;
  deliveryPricingMarkupPct: number;
  lastSyncAt: string | null;
  connectedAt: string | null;
  externalLocationId: string | null;
}

export interface PlatformsResponse {
  platforms: DeliveryPlatformConnection[];
}

export type DeliverySourceKey = Extract<
  OrderSource,
  'UBER_EATS' | 'DELIVEROO' | 'JUST_EAT' | 'DIRECT_QR'
>;

export interface DeliveryPlatformMeta {
  key: DeliverySourceKey;
  label: string;
  icon: string;
  brandColor: string;
  defaultCommissionPct: number;
  apiKey: 'ubereats' | 'deliveroo' | 'justeat' | null; // null = Direct QR (no OAuth)
}

export const DELIVERY_PLATFORMS: DeliveryPlatformMeta[] = [
  {
    key: 'UBER_EATS',
    label: 'Uber Eats',
    icon: '🛵',
    brandColor: '#06C167',
    defaultCommissionPct: 30,
    apiKey: 'ubereats',
  },
  {
    key: 'DELIVEROO',
    label: 'Deliveroo',
    icon: '🦘',
    brandColor: '#00CCBC',
    defaultCommissionPct: 30,
    apiKey: 'deliveroo',
  },
  {
    key: 'JUST_EAT',
    label: 'Just Eat',
    icon: '🍔',
    brandColor: '#FF8000',
    defaultCommissionPct: 14,
    apiKey: 'justeat',
  },
  {
    key: 'DIRECT_QR',
    label: 'Direct QR',
    icon: '📱',
    brandColor: '#E07A4A',
    defaultCommissionPct: 0,
    apiKey: null,
  },
];

export function platformMetaFor(source: DeliverySourceKey): DeliveryPlatformMeta {
  return DELIVERY_PLATFORMS.find((p) => p.key === source) ?? (DELIVERY_PLATFORMS[0] as DeliveryPlatformMeta);
}
