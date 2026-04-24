import type { OrderType, OrderStatus, OrderSource } from '@flick/shared/types';

export interface OrderItemModifier {
  id: string;
  orderItemId: string;
  modifierName: string;
  priceAdd: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  modifiers: OrderItemModifier[];
}

export interface OrderPayment {
  id: string;
  orderId: string;
  method: 'CARD' | 'CASH' | 'SPLIT';
  amount: number;
  tip: number;
  change: number;
  status: 'PENDING' | 'COMPLETED' | 'REFUNDED';
  createdAt: string;
}

export interface Order {
  id: string;
  businessId: string;
  orderNumber: number;
  type: OrderType;
  status: OrderStatus;
  source: OrderSource;
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  vatAmount: number;
  total: number;
  platformOrderId: string | null;
  platformCommissionRate: number | null;
  netAfterCommission: number | null;
  deliveryFee: number | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  items: OrderItem[];
  payments: OrderPayment[];
}

export interface OrdersResponse {
  orders: Order[];
}

export const PLATFORM_META: Record<
  OrderSource,
  { label: string; icon: string; color: string }
> = {
  POS: { label: 'POS', icon: '🏪', color: '#4A8BC8' },
  UBER_EATS: { label: 'Uber Eats', icon: '🛵', color: '#06C167' },
  DELIVEROO: { label: 'Deliveroo', icon: '🦘', color: '#00CCBC' },
  JUST_EAT: { label: 'Just Eat', icon: '🍔', color: '#FF8000' },
  DIRECT_QR: { label: 'Direct QR', icon: '📱', color: '#E07A4A' },
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
};
