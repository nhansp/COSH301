import React from 'react';
import { PriceTrend } from '../../types';
import { describeTrend, isFreshTrend } from '../../services/priceTrend';

/**
 * Subtle marker beside a zone's price when it changed recently. The arrow and
 * the words carry the direction, not only the colour.
 */
export const PriceTrendBadge: React.FC<{ trend?: PriceTrend; className?: string }> = ({ trend, className = '' }) => {
  if (!isFreshTrend(trend)) return null;
  const up = trend.newPrice > trend.oldPrice;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
        up ? 'bg-kumo-warning-tint text-kumo-warning' : 'bg-kumo-success-tint text-kumo-success'
      } ${className}`}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      Giá vừa {describeTrend(trend)}
    </span>
  );
};
