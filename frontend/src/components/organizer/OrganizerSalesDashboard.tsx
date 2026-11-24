import React from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  ExternalLink,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { EventSalesSummary, OrganizerSalesOverview } from '../../services/organizerService';
import { formatPrice, formatPriceShort } from '../../services/eventService';
import { SeatItem } from '../../types';
import { StageSalesHeatmap } from './StageSalesHeatmap';

interface PortfolioOverviewProps {
  overview: OrganizerSalesOverview;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}

export const PortfolioSalesBanner: React.FC<PortfolioOverviewProps> = ({
  overview,
  selectedEventId,
  onSelectEvent
}) => {
  const fillPct = Math.round(overview.fillRate * 100);
  const maxPotential = Math.max(1, ...overview.events.map(e => e.potentialRevenue));

  return (
    <section aria-labelledby="sales-portfolio-heading" className="mb-8 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                Thực thu
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-seat-held" />
                Đang giữ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-violet/35" />
                Tiềm năng còn lại
              </span>
            </div>
          </div>

          <ul className="space-y-2.5">
            {overview.events.map(ev => {
              const active = ev.eventId === selectedEventId;
              const barTotalPct = Math.max(8, (ev.potentialRevenue / maxPotential) * 100);
              const soldShare = ev.potentialRevenue > 0 ? (ev.realizedRevenue / ev.potentialRevenue) * 100 : 0;
              const heldShare = ev.potentialRevenue > 0 ? (ev.heldPipelineRevenue / ev.potentialRevenue) * 100 : 0;
              const evFillPct = Math.round(ev.fillRate * 100);

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
                      <span className="truncate font-semibold text-kumo-strong">{ev.eventName}</span>
                      <span className="type-figure shrink-0 text-kumo-subtle">
                        {evFillPct}% lấp đầy · {formatPriceShort(ev.realizedRevenue)} /{' '}
                        <strong className="text-kumo-strong">{formatPriceShort(ev.potentialRevenue)}</strong>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full rounded-full bg-kumo-recessed">
                      <div
                        className="flex h-full overflow-hidden rounded-full bg-violet/30"
                        style={{ width: `${barTotalPct}%` }}
                      >
                        {soldShare > 0 && <div className="bg-kumo-success" style={{ width: `${soldShare}%` }} />}
                        {heldShare > 0 && <div className="bg-seat-held" style={{ width: `${heldShare}%` }} />}
                      </div>
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
  onOpenAiAnalysis: () => void;
  onOpenStageGraph: (overlay?: 'price' | 'occupancy') => void;
  onSwitchToPricing: () => void;
  onInspectPricing?: (zoneId: string) => void;
}

export const EventSalesDashboard: React.FC<EventSalesDashboardProps> = ({
  summary,
  seats,
  onOpenAiAnalysis,
  onOpenStageGraph,
  onSwitchToPricing,
  onInspectPricing
}) => {
  const fillPct = Math.round(summary.fillRate * 100);
  const maxCeiling = Math.max(1, ...summary.zones.map(z => Math.max(z.ceilingPrice, z.basePrice)));
  const hasStanding = summary.zones.some(z => z.kind === 'standing');
  const topRevenueZone = [...summary.zones].sort((a, b) => b.potentialRevenue - a.potentialRevenue)[0];
  const hottestZone = [...summary.zones].sort((a, b) => b.fillRate - a.fillRate)[0];

  return (
    <div className="space-y-4">
      {/* Event-level KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>

      {/* Stage Sales Thermal Heatmap */}
      <StageSalesHeatmap
        key={summary.eventId}
        summary={summary}
        seats={seats}
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
                  <strong>{topRevenueZone.zoneName}</strong> đóng góp tỉ trọng doanh thu kỳ vọng cao nhất ({formatPrice(topRevenueZone.potentialRevenue)}).
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
                    {z.sold} bán · {z.held} giữ · {z.available} trống ({fillZonePct}%)
                  </span>
                </div>

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
    </div>
  );
};
