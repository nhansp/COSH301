import React, { useState } from 'react';
import { Info, Maximize2, X } from 'lucide-react';
import { SeatItem } from '../../types';
import { PRICE_BAND_COLORS, ZoneSummary } from '../../services/venue';
import { formatPrice } from '../../services/eventService';

const SEAT_STATUS: Record<SeatItem['status'], string> = {
  available: 'Còn trống',
  selected: 'Bạn đang giữ',
  held: 'Người khác đang giữ',
  sold: 'Đã bán'
};

interface VenueOverlayProps {
  /** The legend describes seat cues differently on the flat map and in 3D. */
  mode: '2d' | '3d';
  /** Zone under the pointer, or the zone in focus when nothing is hovered. */
  zone: ZoneSummary | null;
  isActive: boolean;
  seat: SeatItem | null;
  held: number;
  priceRange: [number, number] | null;
  canGoBack: boolean;
  onBack: () => void;
}

const panel = 'rounded-xl bg-[#0f1330]/88 text-stage-ink ring-1 ring-stage-line backdrop-blur-md';

/** Text never sits on the venue itself: section details live in this panel, in a fixed corner. */
export const VenueOverlay: React.FC<VenueOverlayProps> = ({ mode, zone, isActive, seat, held, priceRange, canGoBack, onBack }) => {
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none absolute top-3 left-3 w-[min(18rem,calc(100%-4.5rem))] sm:top-4 sm:left-4">
        {seat ? (
          <div className={`${panel} p-3.5`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-3xl leading-none font-bold [font-stretch:68%]">{seat.label}</span>
              <span className="font-display text-lg font-semibold tabular-nums [font-stretch:75%]">{formatPrice(seat.price)}</span>
            </div>
            <p className="mt-1.5 text-sm text-stage-muted">{seat.zoneName}</p>
            <p className={`mt-2 text-sm font-medium ${seat.status === 'available' ? 'text-seat-available' : seat.status === 'selected' ? 'text-spot' : 'text-stage-muted'}`}>
              {SEAT_STATUS[seat.status]}
              {seat.status === 'available' && <span className="font-normal text-stage-muted"> · chạm để giữ</span>}
              {seat.status === 'selected' && <span className="font-normal text-stage-muted"> · chạm để trả</span>}
            </p>
          </div>
        ) : zone ? (
          <div className={`${panel} p-3.5`}>
            <div className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-1 h-8 w-1.5 shrink-0 rounded-full" style={{ background: zone.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg leading-snug font-semibold [font-stretch:108%]">{zone.name}</p>
                <p className="text-sm text-stage-muted">{zone.kind === 'standing' ? 'Khu đứng, không có chỗ cố định' : 'Ghế ngồi có số'}</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-stage-muted">Giá</dt>
                <dd className="font-display text-base font-semibold tabular-nums [font-stretch:75%]">
                  {priceRange && priceRange[1] > priceRange[0]
                    ? `${formatPrice(priceRange[0])} – ${formatPrice(priceRange[1])}`
                    : formatPrice(zone.priceFrom)}
                </dd>
              </div>
              <div>
                <dt className="text-stage-muted">Còn lại</dt>
                <dd className="font-display text-base font-semibold tabular-nums [font-stretch:75%]">
                  {zone.available === 0 ? 'Hết vé' : `${zone.available} / ${zone.capacity}`}
                </dd>
              </div>
            </dl>
            {(held > 0 || isActive || zone.available === 0) && (
              <p className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
                {held > 0 && <span className="rounded-md bg-spot px-2 py-1 text-spot-ink">Bạn đang giữ {held}</span>}
                {zone.available === 0 && <span className="rounded-md bg-stage-line px-2 py-1">Hết vé</span>}
                {isActive && zone.available > 0 && (
                  <span className="rounded-md bg-stage-line px-2 py-1">
                    {zone.kind === 'standing' ? 'Chọn số vé ở bảng bên cạnh' : 'Chạm vào ghế để giữ'}
                  </span>
                )}
              </p>
            )}
          </div>
        ) : (
          <p className={`${panel} px-3.5 py-2.5 text-sm text-stage-muted`}>Chọn một khu trên sơ đồ để xem giá và chỗ còn lại.</p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 sm:inset-x-4 sm:bottom-4">
        <div className="flex min-w-0 items-end gap-3">
          <div className="pointer-events-auto relative">
            {legendOpen && (
              <div id="venue-legend" className={`${panel} absolute bottom-12 left-0 w-64 p-3.5 text-sm`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">Chú thích</span>
                  <button type="button" onClick={() => setLegendOpen(false)} aria-label="Đóng chú thích" className="grid size-8 place-items-center rounded-md hover:bg-stage-line">
                    <X className="size-4" />
                  </button>
                </div>
                <p className="text-stage-muted">Màu khu theo giá</p>
                <div
                  aria-hidden="true"
                  className="mt-1.5 h-2 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${PRICE_BAND_COLORS.join(', ')})` }}
                />
                <div className="mt-1 flex justify-between text-xs text-stage-muted">
                  <span>Cao nhất</span>
                  <span>Thấp nhất</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className={mode === '3d' ? 'h-3 w-5 rounded-sm bg-[#6b5f8f] shadow-[inset_0_-4px_0_#3d3560]' : 'h-3 w-5 rounded-t-full bg-[#6b5f8f]/60 ring-1 ring-[#6b5f8f]'} />
                    {mode === '3d' ? 'Khán đài: ghế ngồi có số' : 'Hình cung: khán đài ghế ngồi'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={mode === '3d' ? 'h-1.5 w-5 rounded-sm bg-[#6b5f8f]' : 'h-3 w-5 bg-[radial-gradient(circle,#c9b8f0_1px,transparent_1.5px)] bg-[length:4px_4px] ring-1 ring-[#6b5f8f]'} />
                    {mode === '3d' ? 'Sàn phẳng: khu đứng' : 'Ô chấm: khu đứng'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-seat-available" />
                    {mode === '3d' ? 'Ghế còn trống (mang màu khu, chuyển xanh khi bạn chọn khu)' : 'Ghế còn trống'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-spot ring-2 ring-spot/40" />
                    {mode === '3d' ? 'Ghế bạn đang giữ, cao hơn và có vòng sáng' : 'Ghế bạn đang giữ, có vòng sáng'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="seat-held size-3 rounded-full bg-seat-held" />
                    Người khác đang giữ, có sọc
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={mode === '3d' ? 'h-1.5 w-3 rounded-sm bg-seat-sold' : 'size-2 rounded-full bg-seat-sold'} />
                    {mode === '3d' ? 'Đã bán, gập thấp' : 'Đã bán, chấm nhỏ'}
                  </li>
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => setLegendOpen(open => !open)}
              aria-expanded={legendOpen}
              aria-controls="venue-legend"
              className={`${panel} flex h-10 items-center gap-1.5 px-3 text-sm font-medium transition-colors hover:bg-stage-raised`}
            >
              <Info className="size-4" />
              Chú thích
            </button>
          </div>
          <p className="hidden max-w-xs text-xs leading-snug text-stage-muted sm:block">
            Sơ đồ minh hoạ theo hạng vé. Vị trí thật của các khu theo công bố của Ban Tổ chức.
          </p>
        </div>
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            className={`${panel} pointer-events-auto flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-medium transition-colors hover:bg-stage-raised`}
          >
            <Maximize2 className="size-4" />
            Quay lại toàn sân
          </button>
        )}
      </div>
      {/* Phones keep the disclaimer just above the bottom controls instead of beside the legend. */}
      <p className="pointer-events-none absolute right-3 bottom-16 left-3 text-[11px] leading-snug text-stage-muted sm:hidden">
        Sơ đồ minh hoạ theo hạng vé, không theo vị trí thật.
      </p>
    </>
  );
};
