import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MenuResponse, MenuItem, Category } from '@/types/menu';

// Prisma serialises Decimal fields as strings — coerce at the boundary.
function coerceItem(raw: MenuItem & { basePrice: string | number; costPrice: string | number | null }): MenuItem {
  return {
    ...raw,
    basePrice: Number(raw.basePrice),
    costPrice: raw.costPrice == null ? null : Number(raw.costPrice),
    modifierGroups: raw.modifierGroups?.map((g) => ({
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
        items: (res.items as Array<Parameters<typeof coerceItem>[0]>)
          .map(coerceItem)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      } satisfies MenuResponse;
    },
  });
}
