import React, { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { formatPrice } from '../../services/eventService';
import {
  PricingSettings,
  ZoneInputs,
  ZonePricingState,
  apiApproveSuggestion,
  apiRejectSuggestion,
  apiSetZoneDynamicPricing,
  formatPercent,
  pricingActionError,
} from '../../services/pricingService';
import { PriceHistoryChart } from '../pricing/PriceHistoryChart';

const num = (v: number, digits = 2) =>
  v.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN');

/** ▲ for a rise, ▼ for a fall: shape as well as colour, so it reads without colour vision. */
export const ChangeBadge: React.FC<{ percent: number }> = ({ percent }) => {
  const up = percent > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${
        up ? 'bg-kumo-success-tint text-kumo-success' : 'bg-kumo-danger-tint text-kumo-danger'
      }`}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {formatPercent(percent)}
    </span>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg bg-kumo-recessed px-3 py-2">
    <dt className="text-xs text-kumo-subtle">{label}</dt>
    <dd className="mt-0.5 text-base font-semibold text-kumo-strong tabular-nums">{value}</dd>
    {hint && <dd className="text-xs text-kumo-subtle tabular-nums">{hint}</dd>}
  </div>
);

const InputsGrid: React.FC<{ inputs: ZoneInputs }> = ({ inputs }) => (
  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    <Metric
      label="Tốc độ bán"
      value={`${num(inputs.velocityActual)} vé/phút`}
      hint={`${inputs.demandSeats} ghế giữ hoặc bán trong ${inputs.windowMinutes} phút`}
    />
    <Metric
      label="Tốc độ cần đạt"
      value={`${num(inputs.velocityTarget)} vé/phút`}
      hint={`${inputs.remaining} ghế còn lại, ${Math.round(inputs.minutesLeft)} phút`}
    />
    <Metric label="Tốc độ bán / cần đạt" value={`${num(inputs.velocityRatio)}×`} />
    <Metric
      label="Tỷ lệ lấp đầy"
      value={`${Math.round(inputs.fillRate * 100)}%`}
      hint={`${inputs.sold}/${inputs.total} ghế đã bán`}
    />
    <Metric
      label="Ghế đang giữ"
      value={`${Math.round(inputs.heldRatio * 100)}%`}
      hint={`${inputs.held}/${inputs.remaining} ghế còn lại`}
    />
    <Metric label="Hàng chờ" value={`${inputs.queue} người`} />
    <Metric label="Chỉ số áp lực α" value={num(inputs.alpha)} hint="α > 1: cầu cao hơn kế hoạch" />
    <Metric label="Điều chỉnh δ" value={formatPercent(inputs.delta * 100)} hint="Tối đa ±20% mỗi chu kỳ" />
  </dl>
);

interface Props {
  eventId: string;
  zone: ZonePricingState;
  settings: PricingSettings;
  now: number;
  onChanged: () => void;
}

/** The live inputs, the engine's suggestion and the organizer's decision for one zone. */
export const ZonePricingPanel: React.FC<Props> = ({ eventId, zone, settings, now, onChanged }) => {
  const [busy, setBusy] = useState<'approve' | 'reject' | 'toggle' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const act = async (kind: 'approve' | 'reject' | 'toggle', run: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setBusy(kind);
    setError(null);
    setDone(null);
    const res = await run();
    setBusy(null);
    if (res.ok) setDone(ok);
    else setError(pricingActionError(res.error ?? ''));
    // Reload either way: a refused action usually means the data moved on.
    onChanged();
  };

  const pending = zone.pending;
  const preview = zone.preview;
  const previewDiffers = pending && preview && preview.suggestedPrice !== pending.suggestedPrice;

  return (
    <div className="mt-4 pt-4 border-t border-kumo-hairline space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-kumo-strong">Định giá động</h4>
        <label className="flex items-center gap-2 text-sm text-kumo-default min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={zone.isDynamicPricingEnabled}
            disabled={busy !== null}
            onChange={e =>
              act('toggle', () => apiSetZoneDynamicPricing(eventId, zone.zoneId, e.target.checked),
                e.target.checked ? 'Đã bật định giá động cho khu vực.' : 'Đã tắt định giá động cho khu vực.')
            }
            className="size-4 accent-[var(--color-violet-ink)]"
          />
          Tính đề xuất giá cho khu vực này
        </label>
      </div>

      {zone.analysis === 'sales_closed' && (
        <p className="rounded-lg bg-kumo-recessed px-3 py-2 text-sm text-kumo-subtle">Sự kiện không mở bán, không có đề xuất giá.</p>
      )}
      {zone.analysis === 'sold_out' && (
        <p className="rounded-lg bg-kumo-recessed px-3 py-2 text-sm text-kumo-subtle">Khu vực đã hết ghế, không có đề xuất giá.</p>
      )}

      {zone.inputs && <InputsGrid inputs={zone.inputs} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:items-start">
        <div className="space-y-3">
          {pending ? (
            <div className="rounded-xl ring-2 ring-violet-ink p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-kumo-subtle">Đề xuất đang chờ duyệt</span>
                <ChangeBadge percent={pending.changePercent} />
              </div>
              <p className="font-display text-xl font-bold tabular-nums text-kumo-strong">
                {formatPrice(pending.currentPrice)} <span aria-hidden="true">→</span>
                <span className="sr-only"> đổi thành </span> {formatPrice(pending.suggestedPrice)}
              </p>
              <p className="text-sm text-kumo-default">{pending.reason}.</p>
              <p className="text-xs text-kumo-subtle">
                Tính lúc {time(pending.updatedAt)}. Chỉ ghế còn trống đổi giá; ghế đang giữ giữ nguyên giá.
              </p>
              {previewDiffers && (
                <p className="text-xs rounded-lg bg-kumo-warning-tint text-kumo-warning px-2 py-1.5">
                  Theo số liệu hiện tại, đề xuất sẽ là {formatPrice(preview.suggestedPrice)} ({formatPercent(preview.changePercent)}).
                  Bấm "Chạy lại phân tích ngay" để cập nhật.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ink"
                  disabled={busy !== null}
                  onClick={() => act('approve', () => apiApproveSuggestion(pending.id),
                    `Đã duyệt: giá khu vực là ${formatPrice(pending.suggestedPrice)}.`)}
                >
                  <Check className="size-4" />
                  {busy === 'approve' ? 'Đang duyệt...' : 'Duyệt'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy !== null}
                  onClick={() => act('reject', () => apiRejectSuggestion(pending.id), 'Đã từ chối. Giá giữ nguyên.')}
                >
                  <X className="size-4" />
                  {busy === 'reject' ? 'Đang xử lý...' : 'Từ chối'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-kumo-recessed p-3 space-y-1">
              <p className="text-sm font-medium text-kumo-strong">Chưa có đề xuất</p>
              {preview ? (
                <p className="text-sm text-kumo-subtle">
                  Theo số liệu hiện tại, giá nên đổi {formatPercent(preview.changePercent)} ({formatPrice(preview.suggestedPrice)}).
                  {preview.significant
                    ? ' Đề xuất sẽ được tạo ở lần phân tích tới.'
                    : ` Mức này dưới ngưỡng ${settings.minChangePercent}% nên bị bỏ qua.`}
                </p>
              ) : (
                <p className="text-sm text-kumo-subtle">Khu vực này hiện không có số liệu để tính.</p>
              )}
            </div>
          )}

          <p className="text-xs text-kumo-subtle tabular-nums">
            Giá sàn {formatPrice(zone.floorPrice)} · Giá trần {formatPrice(zone.ceilingPrice)}. Giá luôn nằm trong khoảng này.
          </p>

          {error && (
            <p role="alert" className="rounded-lg px-3 py-2 text-sm bg-kumo-danger-tint text-kumo-danger flex items-start gap-2">
              <AlertCircle className="size-4 flex-shrink-0 mt-px" />
              {error}
            </p>
          )}
          {done && !error && (
            <p role="status" className="rounded-lg px-3 py-2 text-sm bg-kumo-success-tint text-kumo-success">
              {done}
            </p>
          )}
        </div>

        <figure className="rounded-xl bg-kumo-recessed p-3">
          <figcaption className="mb-1 text-xs font-medium text-kumo-subtle">Biến động giá gần đây</figcaption>
          <PriceHistoryChart
            history={zone.history}
            current={zone.basePrice}
            floor={zone.floorPrice}
            ceiling={zone.ceilingPrice}
            suggested={pending?.suggestedPrice}
            now={now}
          />
        </figure>
      </div>
    </div>
  );
};
