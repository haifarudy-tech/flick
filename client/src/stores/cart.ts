import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuItem } from '@/types/menu';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export interface CartLine {
  menuItemId: string;
  name: string;
  emoji: string | null;
  unitPrice: number;
  costPrice: number | null;
  quantity: number;
  notes?: string;
  // Modifiers are captured at add-time — simple list for now.
  modifiers?: Array<{ modifierName: string; priceAdd: number }>;
}

export interface HeldOrder {
  id: string;
  createdAt: number;
  label: string; // e.g. "Table 5" or "John"
  type: OrderType;
  tableNumber?: string;
  customerName?: string;
  lines: CartLine[];
}

export interface CartState {
  lines: CartLine[];
  type: OrderType;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  discountPercent: number;
  discountAmount: number;
  notes: string;
  held: HeldOrder[];

  addItem: (item: MenuItem) => void;
  setQuantity: (menuItemId: string, delta: number) => void;
  removeItem: (menuItemId: string) => void;
  setNotes: (menuItemId: string, notes: string) => void;
  clear: () => void;

  setType: (type: OrderType) => void;
  setTable: (n: string) => void;
  setCustomerName: (n: string) => void;
  setCustomerPhone: (n: string) => void;
  setDeliveryAddress: (n: string) => void;
  setDiscountPercent: (n: number) => void;
  setDiscountAmount: (n: number) => void;
  setOrderNotes: (n: string) => void;

  hold: () => void;
  recall: (id: string) => void;
  deleteHeld: (id: string) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      type: 'DINE_IN',
      tableNumber: '1',
      customerName: '',
      customerPhone: '',
      deliveryAddress: '',
      discountPercent: 0,
      discountAmount: 0,
      notes: '',
      held: [],

      addItem: (item) =>
        set((s) => {
          const existing = s.lines.find((l) => l.menuItemId === item.id);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l,
              ),
            };
          }
          return {
            lines: [
              ...s.lines,
              {
                menuItemId: item.id,
                name: item.name,
                emoji: item.emoji,
                unitPrice: item.basePrice,
                costPrice: item.costPrice,
                quantity: 1,
              },
            ],
          };
        }),
      setQuantity: (id, delta) =>
        set((s) => ({
          lines: s.lines
            .map((l) =>
              l.menuItemId === id ? { ...l, quantity: l.quantity + delta } : l,
            )
            .filter((l) => l.quantity > 0),
        })),
      removeItem: (id) =>
        set((s) => ({ lines: s.lines.filter((l) => l.menuItemId !== id) })),
      setNotes: (id, notes) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.menuItemId === id ? { ...l, notes } : l)),
        })),
      clear: () =>
        set({
          lines: [],
          discountPercent: 0,
          discountAmount: 0,
          notes: '',
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
        }),

      setType: (type) => set({ type }),
      setTable: (n) => set({ tableNumber: n }),
      setCustomerName: (customerName) => set({ customerName }),
      setCustomerPhone: (customerPhone) => set({ customerPhone }),
      setDeliveryAddress: (deliveryAddress) => set({ deliveryAddress }),
      setDiscountPercent: (discountPercent) => set({ discountPercent }),
      setDiscountAmount: (discountAmount) => set({ discountAmount }),
      setOrderNotes: (notes) => set({ notes }),

      hold: () => {
        const s = get();
        if (s.lines.length === 0) return;
        const id = `hold-${Date.now()}`;
        const label =
          s.type === 'DINE_IN'
            ? `Table ${s.tableNumber}`
            : s.customerName
            ? s.customerName
            : s.type === 'TAKEAWAY'
            ? 'Takeaway'
            : 'Delivery';
        const held: HeldOrder = {
          id,
          createdAt: Date.now(),
          label,
          type: s.type,
          tableNumber: s.tableNumber,
          customerName: s.customerName,
          lines: s.lines,
        };
        set((prev) => ({
          held: [held, ...prev.held].slice(0, 20),
          lines: [],
          discountPercent: 0,
          discountAmount: 0,
          notes: '',
        }));
      },
      recall: (id) =>
        set((s) => {
          const h = s.held.find((x) => x.id === id);
          if (!h) return {};
          return {
            lines: h.lines,
            type: h.type,
            tableNumber: h.tableNumber ?? s.tableNumber,
            customerName: h.customerName ?? '',
            held: s.held.filter((x) => x.id !== id),
          };
        }),
      deleteHeld: (id) => set((s) => ({ held: s.held.filter((x) => x.id !== id) })),
    }),
    {
      name: 'flick-cart',
      partialize: (s) => ({ held: s.held }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Totals — derived, not stored. Business.vatRate is looked up at submit time.
// ---------------------------------------------------------------------------

export interface CartTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
}

export function computeTotals(
  lines: CartLine[],
  discountPercent: number,
  discountAmount: number,
  vatRate = 20,
  taxInclusive = true,
): CartTotals {
  const subtotal = lines.reduce((s, l) => {
    const mods = l.modifiers?.reduce((a, m) => a + m.priceAdd, 0) ?? 0;
    return s + (l.unitPrice + mods) * l.quantity;
  }, 0);
  const discount = discountAmount + subtotal * (discountPercent / 100);
  const taxable = Math.max(0, subtotal - discount);
  const vat = taxInclusive
    ? taxable - taxable / (1 + vatRate / 100)
    : taxable * (vatRate / 100);
  const total = taxInclusive ? taxable : taxable + vat;
  return { subtotal, discount, taxable, vat, total };
}
