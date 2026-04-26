export interface AnalyticsSummary {
  range: { from: string; to: string };
  revenue: number;
  orders: number;
  avgBasket: number;
  grossMarginPct: number;
  totalTips: number;
  totalRefunds: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byPaymentMethod: Record<string, number>;
}

export interface HourlyBucket {
  hour: number;
  revenue: number;
  orders: number;
}

export interface HourlyResponse {
  hours: HourlyBucket[];
}

export interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

export interface TopItemsResponse {
  items: TopItem[];
}

export interface StaffPerfRow {
  id: string;
  name: string;
  role: string;
  hours: number;
  sales: number;
  orders: number;
  hourlyRate: number;
  labourCost: number;
  labourCostPct: number;
  clockedIn: boolean;
}

export interface StaffPerfResponse {
  staff: StaffPerfRow[];
}

export interface DeliveryPlatformEntry {
  gross: number;
  net: number;
  orders: number;
}

export interface DeliveryBreakdownResponse {
  byPlatform: Record<string, DeliveryPlatformEntry>;
}

export type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
