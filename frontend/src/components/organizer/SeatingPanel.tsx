import React, { useEffect, useMemo, useState } from 'react';
import { MousePointerClick, Radio } from 'lucide-react';
import { FloorPlan2D } from '../tickets/FloorPlan2D';
import { useSeatInventory } from '../../hooks/useSeatInventory';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { apiFetchEventDetail, formatPrice, formatPriceShort } from '../../services/eventService';
import { buildVenueLayout, summarizeZones } from '../../services/venue';
import { SeatItem, TicketTier } from '../../types';

const STATUS_TEXT: Record<SeatItem['status'], string> = {
  available: 'Còn trống',
  held: 'Đang được giữ',
  selected: 'Đang được giữ',
  sold: 'Đã bán'
};

/**
 * The customer 2D floor plan, for inspection only: the same layout, colours and
 * live seat states, but clicking a seat shows its details instead of holding it.
 */
export const SeatingPanel: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const inventory = useSeatInventory({ eventId, maxSeats: Infinity, holdEnabled: false });
  const reducedMotion = usePrefersReducedMotion();
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<SeatItem | null>(null);

  useEffect(() => {
    apiFetchEventDetail(eventId).then(detail => setTiers(detail?.ticketTiers ?? []));
  }, [eventId]);

  const seats = inventory.seats;
  const zones = useMemo(() => summarizeZones(tiers, seats), [tiers, seats]);
  const layout = useMemo(() => buildVenueLayout(zones, seats), [zones, seats]);
  const counts = useMemo(() => {
    const byZone = new Map<string, { held: number; sold: number }>();
    for (const s of seats) {
      const c = byZone.get(s.zoneId) ?? { held: 0, sold: 0 };
      if (s.status === 'sold') c.sold += 1;
      else if (s.status !== 'available') c.held += 1;
      byZone.set(s.zoneId, c);
    }
    return byZone;
  }, [seats]);
  // Keep the inspected seat's status live.
  const seat = inspected ? seats.find(s => s.id === inspected.id) ?? inspected : null;

  if (inventory.loadState === 'error') {
    return <p className="rounded-xl bg-kumo-elevated px-4 py-10 text-center text-kumo-subtle ring ring-kumo-line">Không tải được sơ đồ ghế của sự kiện này.</p>;
  }

  return (
    <section aria-labelledby="seating-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="seating-title" className="text-xl font-semibold text-kumo-strong">
          Sơ đồ ghế 2D
        </h2>
        <p className="flex items-center gap-2 text-sm text-kumo-subtle">
          <Radio className={`size-4 ${inventory.liveState === 'connected' ? 'text-kumo-success' : ''}`} />
          {inventory.liveState === 'connected' ? 'Cập nhật trực tiếp' : 'Đang kết nối lại…'}
        </p>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-kumo-subtle">
        <li className="flex items-center gap-2">
          <span className="size-3.5 rounded bg-seat-available" /> Còn trống
        </li>
        <li className="flex items-center gap-2">
          <span className="seat-held size-3.5 rounded bg-seat-held" /> Đang được giữ
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-3.5 place-items-center rounded bg-kumo-fill text-[9px] leading-none text-kumo-subtle line-through">8</span> Đã bán
        </li>
      </ul>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div aria-label="Sơ đồ 2D nhìn từ trên xuống" className="relative h-[62svh] min-h-96 overflow-hidden rounded-2xl bg-stage lg:h-[640px]">
          {inventory.loadState === 'loading' || zones.length === 0 ? (
            <div className="grid h-full place-items-center text-stage-muted">Đang tải sơ đồ…</div>
          ) : (
            <FloorPlan2D
              layout={layout}
              zones={zones}
              seats={seats}
              activeZoneId={activeZoneId}
              reducedMotion={reducedMotion}
              onZoneSelect={zoneId => {
                setActiveZoneId(zoneId);
                if (!zoneId) setInspected(null);
              }}
              onSeatClick={setInspected}
              highlightZoneId={hoverZoneId}
              inspectOnly
            />
          )}
        </div>

        <aside className="space-y-4">
          <section aria-label="Ghế đang xem" className="rounded-2xl bg-kumo-base p-4 ring ring-kumo-line">
            {seat ? (
              <>
                <p className="text-xs text-kumo-subtle">Ghế đang xem</p>
                <p className="type-figure mt-1 text-2xl text-kumo-strong">{seat.label}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  {[
                    ['Khu vực', seat.zoneName],
                    ['Hàng · số', `${seat.row} · ${seat.number}`],
                    ['Giá hiện tại', formatPrice(seat.price)],
                    ['Trạng thái', STATUS_TEXT[seat.status]]
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-kumo-subtle">{k}</dt>
                      <dd className="text-right text-kumo-default tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="flex items-start gap-2 text-sm text-kumo-subtle">
                <MousePointerClick className="mt-0.5 size-4 flex-shrink-0" />
                Chọn một khu vực trên sơ đồ hoặc trong danh sách, rồi chọn một ghế để xem chi tiết.
              </p>
            )}
          </section>

          <section aria-label="Hạng vé và khu vực" className="overflow-hidden rounded-2xl bg-kumo-base ring ring-kumo-line">
            <h3 className="border-b border-kumo-hairline px-4 py-3 text-sm font-semibold text-kumo-strong">Hạng vé · {zones.length} khu vực</h3>
            <ul className="max-h-[440px] divide-y divide-kumo-hairline overflow-y-auto">
              {zones.map(z => {
                const c = counts.get(z.id) ?? { held: 0, sold: 0 };
                const active = z.id === activeZoneId;
                return (
                  <li key={z.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setActiveZoneId(active ? null : z.id);
                        setInspected(null);
                      }}
                      onPointerEnter={() => setHoverZoneId(z.id)}
                      onPointerLeave={() => setHoverZoneId(null)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
                    >
                      <span className="size-3 flex-shrink-0 rounded-full" style={{ background: z.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-kumo-strong">{z.name}</span>
                        <span className="block text-xs text-kumo-subtle tabular-nums">
                          {z.code} · từ {formatPriceShort(z.priceFrom)}
                        </span>
                      </span>
                      <span className="text-right text-xs text-kumo-subtle tabular-nums">
                        <span className="block font-semibold text-kumo-strong">
                          {z.available}/{z.capacity}
                        </span>
                        {c.sold} bán · {c.held} giữ
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
};
