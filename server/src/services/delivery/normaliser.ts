import type { UnifiedOrderPayload, DeliveryPlatform } from '../../../../shared/types/index.js';

// Each platform sends a different shape. These adapters take their payload
// and map it into our UnifiedOrderPayload. Schemas are simplified — real
// platform payloads include many more fields (promotions, taxes, etc.).

// ---------------- Uber Eats ----------------
export function normaliseUberEats(payload: any, commissionRate = 30): UnifiedOrderPayload {
  const order = payload.order ?? payload;
  const items = (order.items ?? []).map((it: any) => ({
    name: it.title ?? it.name,
    qty: it.quantity ?? 1,
    unitPrice: (it.price?.total_price?.amount ?? it.price ?? 0) / 100,
    modifiers: (it.selected_modifier_groups ?? []).flatMap((g: any) =>
      (g.selected_items ?? []).map((m: any) => ({
        name: m.title ?? m.name,
        priceAdd: (m.price?.total_price?.amount ?? 0) / 100,
      })),
    ),
    notes: it.special_instructions,
  }));
  const subtotal = items.reduce((s: number, it: any) => s + it.unitPrice * it.qty, 0);
  return {
    source: 'UBER_EATS',
    platformOrderId: order.id,
    customerName: order.eater?.first_name,
    deliveryAddress: order.delivery?.location?.street_address_line_one,
    items,
    subtotal,
    platformCommissionRate: commissionRate,
    netAfterCommission: subtotal * (1 - commissionRate / 100),
    deliveryFee: (order.payment?.charges?.delivery_fee?.amount ?? 0) / 100,
    total: (order.payment?.charges?.total?.amount ?? subtotal * 100) / 100,
    estimatedPickupTime: order.estimated_ready_for_pickup_at,
  };
}

// ---------------- Deliveroo ----------------
export function normaliseDeliveroo(payload: any, commissionRate = 30): UnifiedOrderPayload {
  const order = payload.order ?? payload;
  const items = (order.items ?? []).map((it: any) => ({
    name: it.name,
    qty: it.quantity ?? 1,
    unitPrice: (it.unit_price?.fractional ?? 0) / 100,
    modifiers: (it.modifiers ?? []).map((m: any) => ({
      name: m.name,
      priceAdd: (m.unit_price?.fractional ?? 0) / 100,
    })),
    notes: it.notes,
  }));
  const subtotal = items.reduce((s: number, it: any) => s + it.unitPrice * it.qty, 0);
  return {
    source: 'DELIVEROO',
    platformOrderId: order.id ?? order.order_id,
    customerName: order.customer?.first_name,
    deliveryAddress: order.delivery_address?.line_1,
    items,
    subtotal,
    platformCommissionRate: commissionRate,
    netAfterCommission: subtotal * (1 - commissionRate / 100),
    deliveryFee: (order.delivery_fee?.fractional ?? 0) / 100,
    total: (order.total?.fractional ?? subtotal * 100) / 100,
    estimatedPickupTime: order.prepare_for,
  };
}

// ---------------- Just Eat (Flyt) ----------------
export function normaliseJustEat(payload: any, commissionRate = 14): UnifiedOrderPayload {
  const order = payload.order ?? payload;
  const items = (order.items ?? []).map((it: any) => ({
    name: it.productName ?? it.name,
    qty: it.quantity ?? 1,
    unitPrice: Number(it.unitPrice ?? it.price ?? 0),
    modifiers: (it.modifiers ?? it.variants ?? []).map((m: any) => ({
      name: m.name,
      priceAdd: Number(m.price ?? 0),
    })),
    notes: it.notes,
  }));
  const subtotal = items.reduce((s: number, it: any) => s + it.unitPrice * it.qty, 0);
  return {
    source: 'JUST_EAT',
    platformOrderId: order.id ?? order.orderId,
    customerName: order.customer?.firstName,
    customerPhone: order.customer?.phone,
    deliveryAddress: order.deliveryAddress?.line1,
    items,
    subtotal,
    platformCommissionRate: commissionRate,
    netAfterCommission: subtotal * (1 - commissionRate / 100),
    deliveryFee: Number(order.deliveryCharge ?? 0),
    total: Number(order.total ?? subtotal),
    estimatedPickupTime: order.readyAt ?? order.expectedDeliveryTime,
  };
}

export function normalise(platform: DeliveryPlatform, payload: any, commissionRate?: number) {
  switch (platform) {
    case 'UBER_EATS':
      return normaliseUberEats(payload, commissionRate);
    case 'DELIVEROO':
      return normaliseDeliveroo(payload, commissionRate);
    case 'JUST_EAT':
      return normaliseJustEat(payload, commissionRate);
  }
}
