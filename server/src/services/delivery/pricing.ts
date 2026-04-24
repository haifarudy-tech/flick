import type { DeliveryPlatform } from '../../../../shared/types/index.js';

// Per-platform menu item shape used by the sync adapters. Keeps the
// platform-specific payload logic in one place — each adapter just
// transforms the unified list into the target API body.
export interface PricedMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  emoji: string | null;
  isAvailable: boolean;
  modifierGroups: Array<{
    id: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    modifiers: Array<{
      id: string;
      name: string;
      priceAdd: number;
    }>;
  }>;
}

interface RawMenuItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: unknown; // Prisma Decimal
  emoji: string | null;
  isAvailable: boolean;
  categoryId: string | null;
  deliveryPriceUberEats: unknown;
  deliveryPriceDeliveroo: unknown;
  deliveryPriceJustEat: unknown;
  modifierGroups?: Array<{
    id: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    modifiers: Array<{
      id: string;
      name: string;
      priceAdd: unknown;
    }>;
  }>;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

// Decide the price to send to a given delivery platform:
// 1. Use the platform's explicit override if set
// 2. Otherwise apply the connection's deliveryPricingMarkupPct to basePrice
export function pricedMenuFor(
  platform: DeliveryPlatform,
  items: RawMenuItem[],
  markupPct = 0,
): PricedMenuItem[] {
  return items.map((it) => {
    const base = toNum(it.basePrice);
    let price = base * (1 + markupPct / 100);
    if (platform === 'UBER_EATS' && it.deliveryPriceUberEats != null) {
      price = toNum(it.deliveryPriceUberEats);
    } else if (platform === 'DELIVEROO' && it.deliveryPriceDeliveroo != null) {
      price = toNum(it.deliveryPriceDeliveroo);
    } else if (platform === 'JUST_EAT' && it.deliveryPriceJustEat != null) {
      price = toNum(it.deliveryPriceJustEat);
    }
    // Round to 2dp to avoid floating-point drift on platform APIs.
    price = Math.round(price * 100) / 100;
    return {
      id: it.id,
      name: it.name,
      description: it.description,
      price,
      category: it.categoryId,
      emoji: it.emoji,
      isAvailable: it.isAvailable,
      modifierGroups: (it.modifierGroups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        modifiers: g.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          priceAdd: toNum(m.priceAdd),
        })),
      })),
    };
  });
}
