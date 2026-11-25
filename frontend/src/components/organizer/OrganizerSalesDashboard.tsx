import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  BarChart3,
  Clock,
  ExternalLink,
  Flame,
  Mail,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Ticket,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react';
import {
  EventSalesSummary,
  OrganizerCancellationRecord,
  OrganizerSalesOverview,
  groupCancellationsByZone
} from '../../services/organizerService';
import { formatPrice, formatPriceShort } from '../../services/eventService';
import { SeatItem } from '../../types';
import { StageSalesHeatmap } from './StageSalesHeatmap';

function formatDateTimeVi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function matchesEvent(record: OrganizerCancellationRecord, eventId: string, eventName: string): boolean {
  if (record.eventId && eventId) return record.eventId === eventId;
  return record.eventName === eventName;
}

interface PortfolioOverviewProps {
  overview: OrganizerSalesOverview;
  cancellations: OrganizerCancellationRecord[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}

export const PortfolioSalesBanner: React.FC<PortfolioOverviewProps> = ({
  overview,
  cancellations,
  selectedEventId,
  onSelectEvent
}) => {
  const fillPct = (overview.fillRate * 100).toLocaleString('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const totalCancelledSeats = useMemo(
    () => cancellations.reduce((sum, item) => sum + item.seatCount, 0),
    [cancellations]
  );

  const cancelledSeatsByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cancellations) {
      if (!c.eventId) continue;
      map.set(c.eventId, (map.get(c.eventId) ?? 0) + c.seatCount);
    }
    return map;
  }, [cancellations]);

  return (
    <section aria-labelledby="sales-portfolio-heading" className="mb-8 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl bg-kumo-base p-4 ring ring-kumo-line">
          <p className="text-xs font-medium text-kumo-subtle">Tổng thực thu (Đã bán)</p>
          <p className="type-figure mt-1.5 text-2xl text-kumo-success">{formatPriceShort(overview.realizedRevenue)}</p>
          <p className="mt-1 text-xs text-kumo-subtle tabular-nums">
            {overview.soldCount.toLocaleString('vi-VN')} vé đã thanh toán
          </p>
        </div>

        <div className="rounded-2xl bg-kumo-base p-4 ring ring-kumo-line">
          <p className="text-xs font-medium text-kumo-subtle">Đang giữ chỗ (Pipeline)</p>
          <p className="type-figure mt-1.5 text-2xl text-kumo-warning">{formatPriceShort(overview.heldPipelineRevenue)}</p>
          <p className="mt-1 text-xs text-kumo-subtle tabular-nums">
            {overview.heldCount.toLocaleString('vi-VN')} ghế đang giữ 5 phút
          </p>
        </div>

        <div className="rounded-2xl bg-kumo-base p-4 ring ring-kumo-line">
          <p className="text-xs font-medium text-kumo-subtle">Tỉ lệ lấp đầy toàn danh mục</p>
          <p className="type-figure mt-1.5 text-2xl text-kumo-strong">{fillPct}%</p>
          <p className="mt-1 text-xs text-kumo-subtle tabular-nums">
            {(overview.soldCount + overview.heldCount).toLocaleString('vi-VN')} / {overview.totalCapacity.toLocaleString('vi-VN')} chỗ
          </p>
        </div>

        <div className="rounded-2xl bg-kumo-base p-4 ring ring-kumo-line">
          <p className="text-xs font-medium text-kumo-subtle">Doanh thu kỳ vọng ({overview.eventCount} show)</p>
          <p className="type-figure mt-1.5 text-2xl text-violet-ink">{formatPriceShort(overview.potentialRevenue)}</p>
          <p className="mt-1 text-xs text-kumo-subtle tabular-nums">
            Còn trống {overview.availableCount.toLocaleString('vi-VN')} chỗ
          </p>
        </div>

        <div className="col-span-2 rounded-2xl bg-kumo-base p-4 ring ring-kumo-line sm:col-span-1">
          <p className="text-xs font-medium text-kumo-subtle">Vé đã hủy (Toàn danh mục)</p>
          <p
            className={`type-figure mt-1.5 text-2xl ${
              totalCancelledSeats > 0 ? 'text-kumo-danger' : 'text-kumo-strong'
            }`}
          >
            {totalCancelledSeats.toLocaleString('vi-VN')} vé
          </p>
          <p className="mt-1 text-xs text-kumo-subtle tabular-nums">
            {cancellations.length > 0
              ? `${cancellations.length.toLocaleString('vi-VN')} lượt hủy · Đã hoàn kho`
              : 'Chưa ghi nhận lượt hủy'}
          </p>
        </div>
      </div>

      {overview.events.length > 0 && (
        <div className="rounded-2xl bg-kumo-base p-4 ring ring-kumo-line sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="sales-portfolio-heading" className="text-sm font-semibold text-kumo-strong">
              So sánh doanh thu mục tiêu &amp; tỉ lệ lấp đầy theo sự kiện
            </h2>
            <div className="flex items-center gap-3 text-xs text-kumo-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-kumo-success" />
                Đã lấp đầy
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-kumo-fill ring ring-kumo-line" />
                Chưa lấp đầy
              </span>
            </div>
          </div>

          <ul className="space-y-2.5">
            {overview.events.map(ev => {
              const active = ev.eventId === selectedEventId;
              const filledWidthPct = Math.min(100, Math.max(0, ev.fillRate * 100));
              const evFillPct = Math.round(filledWidthPct);
              const evCancelledSeats = cancelledSeatsByEvent.get(ev.eventId) ?? 0;

              return (
                <li key={ev.eventId}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(ev.eventId)}
                    className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                      active ? 'bg-kumo-tint/80 ring ring-violet-ink/60' : 'hover:bg-kumo-recessed/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold text-kumo-strong">{ev.eventName}</span>
                        {evCancelledSeats > 0 && (
                          <span className="shrink-0 rounded-full bg-kumo-danger-tint px-2 py-0.5 text-[10px] font-semibold text-kumo-danger tabular-nums">
                            {evCancelledSeats} vé hủy
                          </span>
                        )}
                      </span>
                      <span className="type-figure shrink-0 text-kumo-subtle">
                        {evFillPct}% lấp đầy · {formatPriceShort(ev.realizedRevenue)} /{' '}
                        <strong className="text-kumo-strong">{formatPriceShort(ev.potentialRevenue)}</strong>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-kumo-fill">
                      {filledWidthPct > 0 && (
                        <div
                          className="h-full rounded-full bg-kumo-success transition-[width] duration-300"
                          style={{ width: `${filledWidthPct}%` }}
                        />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

interface EventSalesDashboardProps {
  summary: EventSalesSummary;
  seats: SeatItem[];
  cancellations: OrganizerCancellationRecord[];
  onOpenAiAnalysis: () => void;
  onOpenStageGraph: (overlay?: 'price' | 'occupancy') => void;
  onSwitchToPricing: () => void;
  onInspectPricing?: (zoneId: string) => void;
}

export const EventSalesDashboard: React.FC<EventSalesDashboardProps> = ({
  summary,
  seats,
  cancellations,
  onOpenAiAnalysis,
  onOpenStageGraph,
  onSwitchToPricing,
  onInspectPricing
}) => {
  const [cancelScope, setCancelScope] = useState<'event' | 'all'>('event');

  const fillPct = Math.round(summary.fillRate * 100);
  const maxCeiling = Math.max(1, ...summary.zones.map(z => Math.max(z.ceilingPrice, z.basePrice)));
  const hasStanding = summary.zones.some(z => z.kind === 'standing');
  const topRevenueZone = [...summary.zones].sort((a, b) => b.potentialRevenue - a.potentialRevenue)[0];
  const hottestZone = [...summary.zones].sort((a, b) => b.fillRate - a.fillRate)[0];

  const eventCancellations = useMemo(
    () => cancellations.filter(item => matchesEvent(item, summary.eventId, summary.eventName)),
    [cancellations, summary.eventId, summary.eventName]
  );

  const eventCancelledSeats = useMemo(
    () => eventCancellations.reduce((sum, item) => sum + item.seatCount, 0),
    [eventCancellations]
  );

  const eventCancelRatePct = useMemo(() => {
    const denom = summary.soldCount + eventCancelledSeats;
    if (denom <= 0) return 0;
    return (eventCancelledSeats / denom) * 100;
  }, [summary.soldCount, eventCancelledSeats]);

  const seatLabelById = useMemo(() => new Map(seats.map(s => [s.id, s.label])), [seats]);
  const zoneCancellationsMap = useMemo(
    () => groupCancellationsByZone(eventCancellations, seats, summary.zones),
    [eventCancellations, seats, summary.zones]
  );

  const scopedCancellations = cancelScope === 'event' ? eventCancellations : cancellations;
  const scopedCancelledSeats = useMemo(
    () => scopedCancellations.reduce((sum, item) => sum + item.seatCount, 0),
    [scopedCancellations]
  );
  const scopedReasonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of scopedCancellations) {
      counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [scopedCancellations]);

  const resolveSeatLabels = (record: OrganizerCancellationRecord): string[] => {
    if (record.seatLabels.length > 0) return record.seatLabels;
    if (matchesEvent(record, summary.eventId, summary.eventName) && record.seatIds.length > 0) {
      const mapped = record.seatIds
        .map(id => seatLabelById.get(id))
        .filter((lbl): lbl is string => Boolean(lbl));
      if (mapped.length > 0) return mapped;
    }
    return [];
  };

  return (
    <div className="space-y-4">
      {/* Event-level KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl bg-kumo-base p-3.5 ring ring-kumo-line">
          <p className="text-xs text-kumo-subtle">Thực thu sự kiện</p>
          <p className="type-figure mt-1 text-xl text-kumo-success">{formatPriceShort(summary.realizedRevenue)}</p>
          <p className="mt-0.5 text-xs text-kumo-subtle tabular-nums">{summary.soldCount} ghế đã bán</p>
        </div>
        <div className="rounded-xl bg-kumo-base p-3.5 ring ring-kumo-line">
          <p className="text-xs text-kumo-subtle">Đang giữ chỗ</p>
          <p className="type-figure mt-1 text-xl text-kumo-warning">{formatPriceShort(summary.heldPipelineRevenue)}</p>
          <p className="mt-0.5 text-xs text-kumo-subtle tabular-nums">{summary.heldCount} ghế giữ tạm</p>
        </div>
        <div className="rounded-xl bg-kumo-base p-3.5 ring ring-kumo-line">
          <p className="text-xs text-kumo-subtle">Tỉ lệ lấp đầy</p>
          <p className="type-figure mt-1 text-xl text-kumo-strong">{fillPct}%</p>
          <p className="mt-0.5 text-xs text-kumo-subtle tabular-nums">
            Ngồi {Math.round(summary.seatedFillRate * 100)}%
            {hasStanding ? ` · Đứng ${Math.round(summary.standingFillRate * 100)}%` : ''}
          </p>
        </div>
        <div className="rounded-xl bg-kumo-base p-3.5 ring ring-kumo-line">
          <p className="text-xs text-kumo-subtle">Doanh thu mục tiêu</p>
          <p className="type-figure mt-1 text-xl text-violet-ink">{formatPriceShort(summary.potentialRevenue)}</p>
          <p className="mt-0.5 text-xs text-kumo-subtle tabular-nums">
            Còn {formatPriceShort(summary.remainingRevenue)}
          </p>
        </div>
        <div className="col-span-2 rounded-xl bg-kumo-base p-3.5 ring ring-kumo-line sm:col-span-1">
          <p className="text-xs text-kumo-subtle">Vé đã hủy</p>
          <p
            className={`type-figure mt-1 text-xl ${
              eventCancelledSeats > 0 ? 'text-kumo-danger' : 'text-kumo-strong'
            }`}
          >
            {eventCancelledSeats} vé
          </p>
          <p className="mt-0.5 text-xs text-kumo-subtle tabular-nums">
            {eventCancellations.length > 0
              ? `${eventCancellations.length} lượt · ${eventCancelRatePct.toLocaleString('vi-VN', {
                  maximumFractionDigits: 1
                })}% hủy`
              : 'Chưa có lượt hủy'}
          </p>
        </div>
      </div>

      {/* Stage Sales Thermal Heatmap */}
      <StageSalesHeatmap
        key={summary.eventId}
        summary={summary}
        seats={seats}
        cancellations={eventCancellations}
        onInspectPricing={onInspectPricing}
      />

      {/* Insight & Quick Action Banner */}
      <div className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-violet/20 text-violet-ink">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-kumo-strong">Nhận định doanh số &amp; gợi ý điều hành</p>
            <p className="text-sm leading-relaxed text-kumo-default">
              {summary.hotZones.length > 0 ? (
                <>
                  <strong>{summary.hotZones.length} khu bán chạy</strong> ({summary.hotZones.slice(0, 3).join(', ')}) đã vượt 70% công suất — cân nhắc nâng giá cơ bản trong biên độ giá trần.{' '}
                </>
              ) : hottestZone && hottestZone.fillRate > 0 ? (
                <>
                  Khu vực có nhu cầu cao nhất là <strong>{hottestZone.zoneName}</strong> ({Math.round(hottestZone.fillRate * 100)}% lấp đầy).{' '}
                </>
              ) : (
                <>
                  Sự kiện hiện còn <strong>{summary.availableCount}/{summary.totalCapacity}</strong> chỗ trống với tổng giá trị tồn kho <strong>{formatPrice(summary.remainingRevenue)}</strong>.{' '}
                </>
              )}
              {topRevenueZone && (
                <>
                  <strong>{topRevenueZone.zoneName}</strong> đóng góp tỉ trọng doanh thu kỳ vọng cao nhất ({formatPrice(topRevenueZone.potentialRevenue)}).{' '}
                </>
              )}
              {eventCancelledSeats > 0 && (
                <>
                  Đã ghi nhận <strong>{eventCancellations.length} lượt hủy</strong> ({eventCancelledSeats} vé) và tự động mở bán lại trên sơ đồ.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={onOpenAiAnalysis} className="btn btn-ink btn-sm h-9 text-xs">
                <BarChart3 className="size-3.5" />
                Phân tích sâu với Trợ lý AI
              </button>
              <button
                type="button"
                onClick={() => onOpenStageGraph('occupancy')}
                className="btn btn-secondary btn-sm h-9 text-xs"
              >
                <Flame className="size-3.5 text-coral" />
                Bản đồ nhiệt sân khấu
              </button>
              <button type="button" onClick={onSwitchToPricing} className="btn btn-secondary btn-sm h-9 text-xs">
                <Wallet className="size-3.5 text-violet-ink" />
                Điều chỉnh khung giá
              </button>
              <Link to={`/events/${summary.eventId}/tickets`} className="btn btn-quiet btn-sm h-9 text-xs">
                Sơ đồ trực tiếp
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Per-Zone Sales & Pricing Corridor Table */}
      <div className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-kumo-strong">Hiệu suất bán vé &amp; biên giá từng khu vực</h3>
            <p className="text-xs text-kumo-subtle">Sắp xếp theo hạng giá từ cao xuống thấp (VIP → Phổ thông)</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-kumo-subtle">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-seat-sold" />
              Đã bán
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-seat-held" />
              Đang giữ
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-seat-available" />
              Còn trống
            </span>
          </div>
        </div>

        <ul className="space-y-3">
          {summary.zones.map(z => {
            const total = Math.max(1, z.capacity);
            const soldPct = (z.sold / total) * 100;
            const heldPct = (z.held / total) * 100;
            const availPct = (z.available / total) * 100;
            const fillZonePct = Math.round(z.fillRate * 100);
            const revShare =
              summary.potentialRevenue > 0 ? Math.round((z.potentialRevenue / summary.potentialRevenue) * 100) : 0;
            const isHot = z.fillRate >= 0.7;
            const isSlow = z.fillRate < 0.2;
            const leftPct = (z.floorPrice / maxCeiling) * 100;
            const spanPct = Math.max(2, ((z.ceilingPrice - z.floorPrice) / maxCeiling) * 100);
            const basePct = (z.basePrice / maxCeiling) * 100;
            const zoneCancel = zoneCancellationsMap.get(z.zoneId);
            const zoneCancelledSeats = zoneCancel?.cancelledSeats ?? 0;
            const latestZoneCancel = zoneCancel?.entries[0];

            return (
              <li key={z.zoneId} className="rounded-xl bg-kumo-recessed/65 p-3.5 ring ring-kumo-line/70">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-kumo-strong">{z.zoneName}</span>
                      <span className="rounded-full bg-kumo-base px-2 py-0.5 text-[11px] text-kumo-subtle ring ring-kumo-line">
                        {z.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'}
                      </span>
                      {z.isDynamicPricingEnabled && (
                        <span className="rounded-full bg-kumo-success-tint px-2 py-0.5 text-[11px] font-medium text-kumo-success">
                          Giá động
                        </span>
                      )}
                      {isHot && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-kumo-danger-tint px-2 py-0.5 text-[11px] font-semibold text-kumo-danger">
                          <TrendingUp className="size-3" />
                          Bán chạy
                        </span>
                      )}
                      {isSlow && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-kumo-warning-tint px-2 py-0.5 text-[11px] font-medium text-kumo-warning">
                          <TrendingDown className="size-3" />
                          Cần kích cầu
                        </span>
                      )}
                      {zoneCancelledSeats > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-kumo-danger-tint px-2 py-0.5 text-[11px] font-semibold text-kumo-danger tabular-nums">
                          <Ban className="size-3" />
                          {zoneCancelledSeats} vé hủy
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="type-figure text-sm text-kumo-strong">{formatPrice(z.basePrice)}</p>
                    <p className="text-[11px] text-kumo-subtle tabular-nums">
                      DT mục tiêu {formatPriceShort(z.potentialRevenue)} ({revShare}%)
                    </p>
                  </div>
                </div>

                {/* Seat occupancy stacked bar */}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-kumo-base">
                    {soldPct > 0 && <div style={{ width: `${soldPct}%` }} className="bg-seat-sold" />}
                    {heldPct > 0 && <div style={{ width: `${heldPct}%` }} className="bg-seat-held" />}
                    {availPct > 0 && <div style={{ width: `${availPct}%` }} className="bg-seat-available" />}
                  </div>
                  <span className="type-figure shrink-0 text-xs text-kumo-default">
                    {z.sold} bán · {z.held} giữ · {z.available} trống ·{' '}
                    <span className={zoneCancelledSeats > 0 ? 'font-semibold text-kumo-danger' : 'text-kumo-subtle'}>
                      {zoneCancelledSeats} hủy
                    </span>{' '}
                    ({fillZonePct}%)
                  </span>
                </div>

                {zoneCancel && latestZoneCancel && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-kumo-danger-tint/40 px-2.5 py-1.5 text-[11px] text-kumo-default ring ring-kumo-danger/20">
                    <span className="inline-flex items-center gap-1 font-semibold text-kumo-danger">
                      <Ban className="size-3" />
                      Đã hủy ({zoneCancel.cancelCount} lượt):
                    </span>
                    <span className="font-medium text-kumo-strong">
                      {latestZoneCancel.seatLabels.length > 0
                        ? `Ghế ${latestZoneCancel.seatLabels.slice(0, 5).join(', ')}${
                            latestZoneCancel.seatLabels.length > 5
                              ? ` +${latestZoneCancel.seatLabels.length - 5}`
                              : ''
                          }`
                        : `${latestZoneCancel.seatCount} ghế`}
                    </span>
                    <span className="truncate text-kumo-subtle">
                      · {latestZoneCancel.record.reason}
                    </span>
                  </p>
                )}

                {/* Pricing corridor indicator */}
                <div className="mt-2.5 grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                  <div className="relative h-2 rounded-full bg-kumo-base">
                    <div
                      className="absolute top-0 bottom-0 rounded-full bg-violet/45"
                      style={{ left: `${leftPct}%`, width: `${spanPct}%` }}
                    />
                    <div
                      title={`Giá cơ bản: ${formatPrice(z.basePrice)}`}
                      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-ink ring-2 ring-kumo-base"
                      style={{ left: `${basePct}%` }}
                    />
                  </div>
                  <span className="type-figure text-[11px] text-kumo-subtle">
                    Sàn {formatPriceShort(z.floorPrice)} — Trần {formatPriceShort(z.ceilingPrice)}
                    {z.priceHeadroomPct > 0 ? ` (+${Math.round(z.priceHeadroomPct * 100)}%)` : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Ticket Cancellation Tracking Panel */}
      <div className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-kumo-hairline pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-kumo-danger-tint text-kumo-danger">
                <Ban className="size-4" />
              </span>
              <h3 className="text-base font-semibold text-kumo-strong">Thông tin hủy vé</h3>
            </div>
            <p className="mt-0.5 text-xs text-kumo-subtle">
              Theo dõi các lượt khách hủy vé từ nhật ký hệ thống — ghế hủy được tự động mở bán lại trên sơ đồ.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Phạm vi thống kê hủy vé"
            className="inline-flex rounded-full bg-kumo-recessed p-0.5 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={cancelScope === 'event'}
              onClick={() => setCancelScope('event')}
              className={`rounded-full px-3 py-1 font-medium transition-colors tabular-nums ${
                cancelScope === 'event'
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'text-kumo-subtle hover:text-kumo-strong'
              }`}
            >
              Sự kiện này ({eventCancellations.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cancelScope === 'all'}
              onClick={() => setCancelScope('all')}
              className={`rounded-full px-3 py-1 font-medium transition-colors tabular-nums ${
                cancelScope === 'all'
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'text-kumo-subtle hover:text-kumo-strong'
              }`}
            >
              Toàn danh mục ({cancellations.length})
            </button>
          </div>
        </div>

        {/* Cancellation Summary Strip */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-lg bg-kumo-recessed/70 px-3 py-2.5 ring ring-kumo-line/70">
            <span className="block text-[11px] text-kumo-subtle">Tổng lượt hủy</span>
            <span className="type-figure mt-0.5 block text-lg text-kumo-strong">
              {scopedCancellations.length.toLocaleString('vi-VN')} lượt
            </span>
          </div>
          <div className="rounded-lg bg-kumo-recessed/70 px-3 py-2.5 ring ring-kumo-line/70">
            <span className="block text-[11px] text-kumo-subtle">Tổng ghế đã hoàn kho</span>
            <span
              className={`type-figure mt-0.5 block text-lg ${
                scopedCancelledSeats > 0 ? 'text-kumo-danger' : 'text-kumo-strong'
              }`}
            >
              {scopedCancelledSeats.toLocaleString('vi-VN')} vé
            </span>
          </div>
          <div className="rounded-lg bg-kumo-recessed/70 px-3 py-2.5 ring ring-kumo-line/70">
            <span className="block text-[11px] text-kumo-subtle">Lượt hủy gần nhất</span>
            <span className="type-figure mt-0.5 block text-sm text-kumo-strong">
              {scopedCancellations[0] ? formatDateTimeVi(scopedCancellations[0].cancelledAt) : 'Chưa có'}
            </span>
          </div>
        </div>

        {/* Top Reasons Breakdown */}
        {scopedReasonCounts.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-kumo-subtle">Lý do phổ biến:</span>
            {scopedReasonCounts.map(([reason, count]) => (
              <span
                key={reason}
                className="inline-flex items-center gap-1 rounded-full bg-kumo-recessed px-2.5 py-0.5 text-[11px] text-kumo-default ring ring-kumo-line/80"
              >
                <span className="max-w-[28ch] truncate">{reason}</span>
                <strong className="font-semibold text-kumo-danger tabular-nums">×{count}</strong>
              </span>
            ))}
          </div>
        )}

        {/* Cancellation History List */}
        {scopedCancellations.length === 0 ? (
          <div className="mt-4 rounded-xl bg-kumo-recessed/60 px-4 py-6 text-center ring ring-kumo-line/70">
            <RotateCcw className="mx-auto size-5 text-kumo-subtle" />
            <p className="mt-2 text-sm font-medium text-kumo-strong">
              {cancelScope === 'event'
                ? 'Sự kiện này chưa có lượt hủy vé nào'
                : 'Chưa có lượt hủy vé nào trên toàn danh mục'}
            </p>
            <p className="mt-0.5 text-xs text-kumo-subtle">
              Khi khách hàng hủy vé, chi tiết ghế hoàn kho và lý do hủy sẽ xuất hiện tại đây.
            </p>
            {cancelScope === 'event' && cancellations.length > 0 && (
              <button
                type="button"
                onClick={() => setCancelScope('all')}
                className="btn btn-secondary btn-sm mt-3 h-8 text-xs"
              >
                Xem {cancellations.length} lượt hủy toàn danh mục
              </button>
            )}
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {scopedCancellations.map(item => {
              const labels = resolveSeatLabels(item);
              const visibleLabels = labels.slice(0, 6);
              const overflowCount = Math.max(0, labels.length - visibleLabels.length);

              return (
                <li
                  key={item.id}
                  className="rounded-xl bg-kumo-recessed/65 p-3.5 ring ring-kumo-line/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-kumo-danger-tint px-2 py-0.5 text-[11px] font-semibold text-kumo-danger">
                          <Ban className="size-3" />
                          Đã hủy · Mở bán lại
                        </span>
                        {item.bookingCode && (
                          <span className="rounded bg-kumo-base px-1.5 py-0.5 font-mono text-[11px] text-kumo-default ring ring-kumo-line/80">
                            {item.bookingCode}
                          </span>
                        )}
                        {item.tierName && (
                          <span className="rounded-full bg-kumo-base px-2 py-0.5 text-[11px] text-kumo-subtle ring ring-kumo-line/80">
                            {item.tierName}
                          </span>
                        )}
                        {cancelScope === 'all' && (
                          <span className="truncate text-xs font-semibold text-kumo-strong">
                            {item.eventName}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                        <span className="inline-flex items-center gap-1 font-medium text-kumo-strong">
                          <Ticket className="size-3.5 text-violet-ink" />
                          {visibleLabels.length > 0 ? (
                            <>
                              Ghế {visibleLabels.join(', ')}
                              {overflowCount > 0 ? ` +${overflowCount} ghế` : ''}
                            </>
                          ) : (
                            `${item.seatCount} ghế`
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3.5" />
                          <span className="break-all">{item.customerEmail}</span>
                        </span>
                        {item.totalAmount && (
                          <span className="type-figure text-kumo-default">
                            Giá trị {formatPrice(item.totalAmount)}
                          </span>
                        )}
                      </div>

                      <p className="flex items-start gap-1.5 text-xs text-kumo-default">
                        <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-kumo-subtle" />
                        <span>
                          <span className="text-kumo-subtle">Lý do: </span>
                          {item.reason}
                        </span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] text-kumo-subtle tabular-nums">
                        <Clock className="size-3" />
                        {formatDateTimeVi(item.cancelledAt)}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-kumo-danger tabular-nums">
                        −{item.seatCount} vé
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
