import { PriceTrend } from '../types';

/** How long a change is still "just now"; matches the backend's recent change window. */
export const TREND_FRESH_MS = 30 * 60_000;

export function isFreshTrend(trend: PriceTrend | undefined, now = Date.now()): trend is PriceTrend {
  return !!trend && trend.oldPrice > 0 && trend.newPrice !== trend.oldPrice && now - trend.at < TREND_FRESH_MS;
}

/** "tăng 5%" or "giảm 12,5%". */
export function describeTrend(trend: PriceTrend): string {
  const pct = (Math.abs(trend.newPrice - trend.oldPrice) / trend.oldPrice) * 100;
  const text = pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${trend.newPrice > trend.oldPrice ? 'tăng' : 'giảm'} ${text}%`;
}
