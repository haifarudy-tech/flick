import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface PublicModifier {
  id: string;
  name: string;
  priceAdd: number;
  isAvailable: boolean;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: PublicModifier[];
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  imageUrl?: string;
  basePrice: number;
  categoryId?: string;
  sortOrder: number;
  isPopular: boolean;
  modifierGroups: PublicModifierGroup[];
}

export interface PublicCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PublicBusiness {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  city?: string;
  postcode?: string;
  plan: string;
  currency: string;
}

export interface PublicMenuData {
  business: PublicBusiness;
  categories: PublicCategory[];
  items: PublicMenuItem[];
}

export function usePublicMenu(slug: string) {
  return useQuery<PublicMenuData>({
    queryKey: ['publicMenu', slug],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/menu/public/${slug}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message ?? 'Menu not found');
      }
      return res.json() as Promise<PublicMenuData>;
    },
    staleTime: 30_000,
    retry: false,
  });
}
