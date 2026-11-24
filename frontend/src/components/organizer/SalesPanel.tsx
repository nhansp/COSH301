import React from 'react';
import { Info } from 'lucide-react';
import { InventoryBar } from './InventoryBar';
import { formatPrice } from '../../services/eventService';
import { OrganizerEventDetail } from '../../services/organizerService';

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
    <p className="text-xs text-kumo-subtle">{label}</p>
    <p className="type-figure mt-1 text-2xl text-kumo-strong tabular-nums">{value}</p>
    {note && <p className="mt-0.5 text-xs text-kumo-subtle">{note}</p>}
  </div>
);

/** Tickets sold, held and left, for the event and per ticket category. */
export const SalesPanel: React.FC<{ event: OrganizerEventDetail; paymentsLive: boolean }> = ({ event, paymentsLive }) => {
  const zones = event.zones ?? [];
  const sum = (f: (z: (typeof zones)[number]) => number) => zones.reduce((n, z) => n + f(z), 0);
  const totals = { capacity: sum(z => z.capacity), sold: sum(z => z.sold), held: sum(z => z.held), available: sum(z => z.available) };
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

  return (
    <section aria-labelledby="sales-title" className="space-y-5">
      <h2 id="sales-title" className="text-xl font-semibold text-kumo-strong">
        Doanh số và tồn kho
      </h2>
      {!paymentsLive && (
        <p className="flex items-start gap-2 rounded-lg bg-kumo-info-tint px-3 py-2 text-sm text-kumo-info">
          <Info className="mt-px size-4 flex-shrink-0" />
          Thanh toán chưa bật, nên “đã bán” chỉ tăng khi có vé được phát hành. Số ghế đang giữ cho thấy nhu cầu hiện tại.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sức chứa" value={String(totals.capacity)} note={`${zones.length} hạng vé`} />
        <Stat label="Đã bán" value={String(totals.sold)} note={`${pct(totals.sold, totals.capacity)}% sức chứa`} />
        <Stat label="Đang giữ" value={String(totals.held)} />
        <Stat label="Còn trống" value={String(totals.available)} note={`${pct(totals.available, totals.capacity)}% sức chứa`} />
      </div>

      <div className="rounded-2xl bg-kumo-base p-5 ring ring-kumo-line">
        <p className="mb-2 text-sm font-semibold text-kumo-strong">Toàn sự kiện</p>
        <InventoryBar counts={totals} />
      </div>

      <div className="overflow-x-auto rounded-2xl ring ring-kumo-line">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-kumo-recessed text-xs text-kumo-subtle">
            <tr>
              <th className="px-4 py-2.5 font-medium">Hạng vé</th>
              <th className="px-4 py-2.5 text-right font-medium">Giá hiện tại</th>
              <th className="px-4 py-2.5 text-right font-medium">Sức chứa</th>
              <th className="px-4 py-2.5 text-right font-medium">Đã bán</th>
              <th className="px-4 py-2.5 text-right font-medium">Đang giữ</th>
              <th className="px-4 py-2.5 text-right font-medium">Còn trống</th>
              <th className="w-48 px-4 py-2.5 font-medium">Tỷ lệ bán</th>
            </tr>
          </thead>
          <tbody className="bg-kumo-base">
            {zones.map(z => (
              <tr key={z.zoneId} className="border-t border-kumo-hairline">
                <td className="px-4 py-3">
                  <span className="font-medium text-kumo-strong">{z.zoneName}</span>
                  <span className="block text-xs text-kumo-subtle">{z.zoneCode}</span>
                </td>
                <td className="px-4 py-3 text-right text-kumo-default tabular-nums">{formatPrice(z.basePrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{z.capacity}</td>
                <td className="px-4 py-3 text-right tabular-nums">{z.sold}</td>
                <td className="px-4 py-3 text-right tabular-nums">{z.held}</td>
                <td className="px-4 py-3 text-right tabular-nums">{z.available}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-kumo-fill" aria-hidden="true">
                      <div className="h-full rounded-full bg-seat-sold" style={{ width: `${pct(z.sold, z.capacity)}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs text-kumo-subtle tabular-nums">{pct(z.sold, z.capacity)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
