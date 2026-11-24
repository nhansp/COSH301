import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Layers, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { EnrichedEvent } from '../../services/assistantService';
import { formatPrice, formatPriceShort } from '../../services/eventService';
import { EventSalesSummary, apiFetchEventSalesSummary } from '../../services/organizerService';

function fallbackSummaryFromEnriched(item: EnrichedEvent): EventSalesSummary {
  const zones = item.zones.map(z => {
    const realized = z.sold * z.basePrice;
    const heldRev = z.held * z.basePrice;
    const headroom = z.basePrice > 0 && z.ceilingPrice > z.basePrice ? (z.ceilingPrice - z.basePrice) / z.basePrice : 0;
    return {
      zoneId: z.zoneId,
      zoneCode: z.zoneCode,
      zoneName: z.zoneName,
      kind: z.kind,
      capacity: z.totalSeats,
      sold: z.sold,
      held: z.held,
      available: z.available,
      fillRate: z.occupancyRate,
      basePrice: z.basePrice,
      floorPrice: z.floorPrice,
      ceilingPrice: z.ceilingPrice,
      isDynamicPricingEnabled: z.isDynamicPricingEnabled,
      realizedRevenue: realized,
      heldPipelineRevenue: heldRev,
      potentialRevenue: z.potentialRevenue,
      priceHeadroomPct: headroom
    };
  });

  const standing = zones.filter(z => z.kind === 'standing');
  const seated = zones.filter(z => z.kind === 'seated');
  const rateOf = (list: typeof zones) => {
    const cap = list.reduce((s, z) => s + z.capacity, 0);
    if (cap === 0) return 0;
    return list.reduce((s, z) => s + z.sold + z.held, 0) / cap;
  };
  const realizedRevenue = zones.reduce((s, z) => s + z.realizedRevenue, 0);
  const heldPipelineRevenue = zones.reduce((s, z) => s + z.heldPipelineRevenue, 0);

  return {
    eventId: item.event.id,
    eventName: item.event.title,
    slug: item.event.slug ?? item.event.id,
    city: item.event.city,
    venueName: item.event.venue,
    startsAt: item.event.rawDate,
    totalCapacity: item.totalSeats,
    soldCount: item.soldSeats,
    heldCount: item.heldSeats,
    availableCount: item.availableSeats,
    fillRate: item.occupancyRate,
    realizedRevenue,
    heldPipelineRevenue,
    potentialRevenue: item.potentialRevenue,
    remainingRevenue: Math.max(0, item.potentialRevenue - realizedRevenue),
    standingFillRate: rateOf(standing),
    seatedFillRate: rateOf(seated),
    hotZones: zones.filter(z => z.fillRate >= 0.7).map(z => z.zoneName),
    slowZones: zones.filter(z => z.fillRate < 0.2).map(z => z.zoneName),
    zones
  };
}

interface SalesBriefCardProps {
  initialEventId: string;
  events: EnrichedEvent[];
  initialSummary?: EventSalesSummary | null;
  onOpenStageHeatmap?: (eventId: string) => void;
}

export const SalesBriefCard: React.FC<SalesBriefCardProps> = ({
  initialEventId,
  events,
  initialSummary,
  onOpenStageHeatmap
}) => {
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [cache, setCache] = useState<Record<string, EventSalesSummary>>(() =>
    initialSummary ? { [initialSummary.eventId]: initialSummary } : {}
  );
  const [loading, setLoading] = useState(false);

  const currentEnriched = useMemo(
    () => events.find(e => e.event.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  useEffect(() => {
    if (!currentEnriched || cache[currentEnriched.event.id]) return;
    let cancelled = false;
    setLoading(true);
    apiFetchEventSalesSummary(currentEnriched.event.id)
      .then(data => {
        if (!cancelled && data) {
          setCache(prev => ({ ...prev, [data.eventId]: data }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentEnriched, cache]);

  const summary = useMemo(() => {
    if (!currentEnriched) return null;
    return cache[currentEnriched.event.id] ?? fallbackSummaryFromEnriched(currentEnriched);
  }, [currentEnriched, cache]);

  if (!summary) return null;

  const fillPct = Math.round(summary.fillRate * 100);
  const topZone = [...summary.zones].sort((a, b) => b.potentialRevenue - a.potentialRevenue)[0];
  const hottestZone = [...summary.zones].sort((a, b) => b.fillRate - a.fillRate)[0];
  const hasStanding = summary.zones.some(z => z.kind === 'standing');

  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-kumo-base ring ring-kumo-line">
      {/* Event Switcher */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-kumo-hairline bg-kumo-recessed/70 px-3 py-2 no-scrollbar">
        {events.map(item => {
          const active = item.event.id === summary.eventId;
          const shortTitle = item.event.title.replace(/^Concert\s+/i, '').slice(0, 26);
          return (
            <button
              key={item.event.id}
              type="button"
              onClick={() => setSelectedEventId(item.event.id)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'bg-kumo-base text-kumo-subtle ring ring-kumo-line hover:text-kumo-strong'
              }`}
            >
              {shortTitle}
              {item.event.title.length > 26 ? '…' : ''}
            </button>
          );
        })}
      </div>

      {/* 4-KPI Strip */}
      <div className="grid grid-cols-2 gap-2 border-b border-kumo-hairline p-3 sm:grid-cols-4">
        <div className="rounded-xl bg-kumo-recessed px-2.5 py-2">
          <p className="text-[10px] text-kumo-subtle">Thực thu (Đã bán)</p>
          <p className="type-figure mt-0.5 text-sm text-kumo-success">{formatPriceShort(summary.realizedRevenue)}</p>
          <p className="text-[10px] text-kumo-subtle">{summary.soldCount} vé</p>
        </div>
        <div className="rounded-xl bg-kumo-recessed px-2.5 py-2">
          <p className="text-[10px] text-kumo-subtle">Đang giữ chỗ</p>
          <p className="type-figure mt-0.5 text-sm text-kumo-warning">{formatPriceShort(summary.heldPipelineRevenue)}</p>
          <p className="text-[10px] text-kumo-subtle">{summary.heldCount} ghế</p>
        </div>
        <div className="rounded-xl bg-kumo-recessed px-2.5 py-2">
          <p className="text-[10px] text-kumo-subtle">Tỉ lệ lấp đầy</p>
          <p className="type-figure mt-0.5 text-sm text-kumo-strong">{fillPct}%</p>
          <p className="text-[10px] text-kumo-subtle">
            {summary.soldCount + summary.heldCount}/{summary.totalCapacity} chỗ
          </p>
        </div>
        <div className="rounded-xl bg-kumo-recessed px-2.5 py-2">
          <p className="text-[10px] text-kumo-subtle">Doanh thu kỳ vọng</p>
          <p className="type-figure mt-0.5 text-sm text-violet-ink">{formatPriceShort(summary.potentialRevenue)}</p>
          <p className="text-[10px] text-kumo-subtle">Còn {summary.availableCount} chỗ</p>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {/* Seated vs Standing split */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-kumo-subtle">
          <span className="font-medium text-kumo-strong">
            Hiệu suất theo khu vực {loading ? '(đang cập nhật…)' : ''}
          </span>
          <span className="flex items-center gap-2 text-[11px]">
            <span>
              Ngồi: <strong className="type-figure text-kumo-strong">{Math.round(summary.seatedFillRate * 100)}%</strong>
            </span>
            {hasStanding && (
              <span>
                Đứng: <strong className="type-figure text-kumo-strong">{Math.round(summary.standingFillRate * 100)}%</strong>
              </span>
            )}
          </span>
        </div>

        {/* Per-zone sales rows */}
        <ul className="space-y-2">
          {summary.zones.map(z => {
            const zPct = Math.round(z.fillRate * 100);
            const isHot = z.fillRate >= 0.7;
            const isSlow = z.fillRate < 0.2;
            const headroomPct = Math.round(z.priceHeadroomPct * 100);
            return (
              <li key={z.zoneId} className="rounded-xl bg-kumo-recessed/65 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-semibold text-kumo-strong">{z.zoneName}</span>
                    {isHot && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-kumo-danger-tint px-1.5 py-0.5 text-[10px] font-semibold text-kumo-danger">
                        <TrendingUp className="size-2.5" />
                        Bán chạy
                      </span>
                    )}
                    {isSlow && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-kumo-warning-tint px-1.5 py-0.5 text-[10px] font-medium text-kumo-warning">
                        <TrendingDown className="size-2.5" />
                        Chậm
                      </span>
                    )}
                  </div>
                  <span className="type-figure shrink-0 text-kumo-strong">{formatPrice(z.basePrice)}</span>
                </div>

                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-kumo-base">
                    <div
                      className={`h-full rounded-full ${isHot ? 'bg-coral' : 'bg-violet'}`}
                      style={{ width: `${Math.max(zPct > 0 ? 4 : 0, zPct)}%` }}
                    />
                  </div>
                  <span className="type-figure text-[11px] text-kumo-subtle">
                    {z.sold} bán · {z.held} giữ · {z.available} trống ({zPct}%)
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-kumo-subtle">
                  <span>
                    Khung giá: {formatPriceShort(z.floorPrice)}–{formatPriceShort(z.ceilingPrice)}
                    {headroomPct > 0 && ` (+${headroomPct}% biên tăng)`}
                  </span>
                  <span className="type-figure">
                    DT tiềm năng {formatPriceShort(z.potentialRevenue)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Actionable Organizer Recommendation */}
        <div className="flex items-start gap-2 rounded-xl bg-kumo-info-tint/70 px-3 py-2 text-xs text-kumo-default">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-ink" />
          <p className="leading-relaxed">
            {summary.hotZones.length > 0 ? (
              <>
                <strong>{summary.hotZones.length} khu bán chạy</strong> ({summary.hotZones.slice(0, 2).join(', ')}) — có thể cân nhắc tăng nhẹ giá cơ bản trong khung giá trần.{' '}
              </>
            ) : hottestZone && hottestZone.fillRate > 0 ? (
              <>
                Khu hút khách nhất hiện tại là <strong>{hottestZone.zoneName}</strong> ({Math.round(hottestZone.fillRate * 100)}% lấp đầy).{' '}
              </>
            ) : (
              <>
                Đêm diễn hiện còn trống <strong>{summary.availableCount}/{summary.totalCapacity}</strong> chỗ (giá trị còn lại {formatPriceShort(summary.remainingRevenue)}).{' '}
              </>
            )}
            {topZone && (
              <>
                Khu đóng góp doanh thu mục tiêu lớn nhất là <strong>{topZone.zoneName}</strong> ({formatPriceShort(topZone.potentialRevenue)}).
              </>
            )}
          </p>
        </div>

        {/* Cross-actions */}
        <div className="flex flex-wrap gap-2">
          {onOpenStageHeatmap && (
            <button
              type="button"
              onClick={() => onOpenStageHeatmap(summary.eventId)}
              className="btn btn-secondary btn-sm h-8 flex-1 text-xs"
            >
              <Flame className="size-3.5 text-coral" />
              Bản đồ nhiệt sân khấu
            </button>
          )}
          <Link to="/organizer" className="btn btn-ink btn-sm h-8 flex-1 text-xs">
            <Layers className="size-3.5" />
            Cấu hình giá khu vực
          </Link>
        </div>
      </div>
    </div>
  );
};
