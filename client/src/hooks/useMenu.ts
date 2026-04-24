import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MenuResponse, MenuItem, Category } from '@/types/menu';

// Prisma serialises Decimal fields as strings — coerce at the boundary.
function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function coerceItem(raw: Record<string, unknown>): MenuItem {
  const groups = raw.modifierGroups as MenuItem['modifierGroups'] | undefined;
  return {
    ...(raw as unknown as MenuItem),
    basePrice: Number(raw.basePrice ?? 0),
    costPrice: n(raw.costPrice),
    deliveryPriceUberEats: n(raw.deliveryPriceUberEats),
    deliveryPriceDeliveroo: n(raw.deliveryPriceDeliveroo),
    deliveryPriceJustEat: n(raw.deliveryPriceJustEat),
    modifierGroups: groups?.map((g) => ({
      ...g,
      modifiers: g.modifiers.map((m) => ({ ...m, priceAdd: Number(m.priceAdd) })),
    })),
  };
}

export function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      const res = await api.get<{ categories: Category[]; items: unknown[] }>(
        '/api/v1/menu',
      );
      return {
        categories: res.categories.sort((a, b) => a.sortOrder - b.sortOrder),
        items: (res.items as Record<string, unknown>[])
          .map(coerceItem)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      } satisfies MenuResponse;
    },
  });
}
