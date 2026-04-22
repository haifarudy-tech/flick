// Client view of the menu objects returned by GET /api/v1/menu.
// These are intentionally loose — Prisma serialises Decimal as string, so we
// coerce to number at the hook boundary.

export interface Category {
  id: string;
  businessId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItemModifier {
  id: string;
  groupId: string;
  name: string;
  priceAdd: number;
  isAvailable: boolean;
}

export interface MenuItemModifierGroup {
  id: string;
  menuItemId: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: MenuItemModifier[];
}

export interface MenuItem {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  emoji: string | null;
  imageUrl: string | null;
  basePrice: number;
  costPrice: number | null;
  isAvailable: boolean;
  isPopular: boolean;
  sortOrder: number;
  modifierGroups?: MenuItemModifierGroup[];
}

export interface MenuResponse {
  categories: Category[];
  items: MenuItem[];
}
