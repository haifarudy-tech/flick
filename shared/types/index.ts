// Types shared between the client and server. Kept deliberately small and
// framework-agnostic so both packages can import freely.

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN';

export type Plan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export type OrderStatus =
  | 'NEW'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'CANCELLED';

export type OrderSource =
  | 'POS'
  | 'UBER_EATS'
  | 'DELIVEROO'
  | 'JUST_EAT'
  | 'DIRECT_QR';

export type PaymentMethod = 'CARD' | 'CASH' | 'SPLIT';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'REFUNDED';

export type DeliveryPlatform = 'UBER_EATS' | 'DELIVEROO' | 'JUST_EAT';

export type PlatformConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING';

export interface UnifiedOrderPayload {
  source: OrderSource;
  platformOrderId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    modifiers?: Array<{ name: string; priceAdd: number }>;
    notes?: string;
  }>;
  subtotal: number;
  platformCommissionRate?: number;
  netAfterCommission?: number;
  deliveryFee?: number;
  total: number;
  estimatedPickupTime?: string;
}

export interface SocketEvents {
  'order:new': { orderId: string; order: unknown };
  'order:updated': { orderId: string; status: OrderStatus };
  'order:cancelled': { orderId: string; reason?: string };
  'menu:synced': { platform: DeliveryPlatform; itemCount: number };
  'platform:order': { orderId: string; platform: DeliveryPlatform };
}

export const PLAN_LIMITS: Record<
  Plan,
  {
    maxLocations: number;
    maxMenuItems: number;
    analyticsDays: number;
    deliveryPlatforms: number;
    kitchenDisplay: boolean;
    inventory: boolean;
    staffManagement: boolean;
    qrOrdering: boolean;
  }
> = {
  FREE: {
    maxLocations: 1,
    maxMenuItems: 50,
    analyticsDays: 1,
    deliveryPlatforms: 0,
    kitchenDisplay: false,
    inventory: false,
    staffManagement: false,
    qrOrdering: false,
  },
  STARTER: {
    maxLocations: 1,
    maxMenuItems: Infinity,
    analyticsDays: 30,
    deliveryPlatforms: 1,
    kitchenDisplay: false,
    inventory: false,
    staffManagement: false,
    qrOrdering: true,
  },
  PRO: {
    maxLocations: 1,
    maxMenuItems: Infinity,
    analyticsDays: 365,
    deliveryPlatforms: 3,
    kitchenDisplay: true,
    inventory: true,
    staffManagement: true,
    qrOrdering: true,
  },
  ENTERPRISE: {
    maxLocations: Infinity,
    maxMenuItems: Infinity,
    analyticsDays: 365,
    deliveryPlatforms: 3,
    kitchenDisplay: true,
    inventory: true,
    staffManagement: true,
    qrOrdering: true,
  },
};

export const PLAN_ORDER: Plan[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

export function planMeets(current: Plan, required: Plan): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required);
}
