export const fmt = (n: number) => `£${Number(n || 0).toFixed(2)}`;

export const fmtK = (n: number) =>
  n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : fmt(n);

export const fmtPercent = (n: number) => `${Math.round(n)}%`;

export const marginPct = (price: number, cost: number | null | undefined) => {
  if (!price || !cost) return 0;
  return Math.max(0, Math.round(((price - cost) / price) * 100));
};
