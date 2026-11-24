import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { InventoryBar } from '../components/organizer/InventoryBar';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Gauge,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import { LineChart, SERIES_COLORS } from '../components/pricing/LineChart';
import { formatPrice, formatPriceShort } from '../services/eventService';
import { apiUpdateZonePricing, pricingErrorMessage } from '../services/organizerService';
import {
  AUTO_BLOCK_LABEL,
  PriceChange,
  PricingAlert,
  PricingMode,
  PricingOverview,
  PricingSettings,
  TRIGGER_LABEL,
  ZonePricingView,
  analyzePricingNow,
  approveSuggestion,
  fetchPriceHistory,
  fetchPricingAlerts,
  fetchPricingOverview,
  markAlertRead,
  markAllAlertsRead,
  pricingError,
  rejectSuggestion,
  savePricingSettings,
  setZoneIncluded,
  subscribePricing
} from '../services/pricingService';

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const pct = (v: number) => `${Math.round(v * 100)}%`;

const MODES: { mode: PricingMode; title: string; body: string }[] = [
  { mode: 'OFF', title: 'Tắt', body: 'Giá cố định. Hệ thống không phân tích và không gửi đề xuất.' },
  {
    mode: 'MANUAL',
    title: 'Thủ công, AI đề xuất',
    body: 'Bạn tự đặt giá. Hệ thống theo dõi bán vé, gửi đề xuất tăng, giảm hoặc giữ giá kèm lý do. Không bao giờ tự đổi giá.'
  },
  {
    mode: 'AUTO',
    title: 'Tự động',
    body: 'Hệ thống tự đổi giá theo nhu cầu, luôn trong khoảng sàn, trần bạn đã duyệt, mỗi lần tối đa một bước và có thời gian chờ giữa hai lần đổi.'
  }
];

const ALERT_LABEL: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
  SELLING_FAST: { label: 'Bán nhanh', tone: 'text-kumo-success', icon: <TrendingUp className="size-4" /> },
  SELLING_SLOW: { label: 'Bán chậm', tone: 'text-kumo-warning', icon: <TrendingDown className="size-4" /> },
  RECOMMENDATION: { label: 'Đề xuất mới', tone: 'text-violet-ink', icon: <Sparkles className="size-4" /> },
  AUTO_ADJUSTED: { label: 'Đã tự đổi giá', tone: 'text-kumo-info', icon: <Zap className="size-4" /> },
  AT_CEILING: { label: 'Chạm giá trần', tone: 'text-kumo-warning', icon: <ShieldAlert className="size-4" /> },
  AT_FLOOR: { label: 'Chạm giá sàn', tone: 'text-kumo-warning', icon: <ShieldAlert className="size-4" /> },
  INSUFFICIENT_DATA: { label: 'Thiếu dữ liệu', tone: 'text-kumo-subtle', icon: <Gauge className="size-4" /> },
  BOUNDS_NOT_APPROVED: { label: 'Chưa duyệt sàn, trần', tone: 'text-kumo-danger', icon: <ShieldAlert className="size-4" /> }
};

const DEMAND_LABEL = { LOW: 'Thấp', ON_TRACK: 'Đúng kế hoạch', HIGH: 'Cao' } as const;

const Banner: React.FC<{ tone: 'error' | 'ok'; children: React.ReactNode }> = ({ tone, children }) => (
  <p
    role={tone === 'error' ? 'alert' : 'status'}
    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
      tone === 'error' ? 'bg-kumo-danger-tint text-kumo-danger' : 'bg-kumo-success-tint text-kumo-success'
    }`}
  >
    {tone === 'error' ? <AlertCircle className="mt-px size-4 flex-shrink-0" /> : <CheckCircle2 className="mt-px size-4 flex-shrink-0" />}
    {children}
  </p>
);

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
    <p className="text-xs text-kumo-subtle">{label}</p>
    <p className="type-figure mt-1 text-2xl text-kumo-strong tabular-nums">{value}</p>
    {note && <p className="mt-0.5 text-xs text-kumo-subtle">{note}</p>}
  </div>
);

const ModeCard: React.FC<{
  overview: PricingOverview;
  busy: boolean;
  onSave: (s: PricingSettings) => void;
}> = ({ overview, busy, onSave }) => {
  const [mode, setMode] = useState<PricingMode>(overview.mode);
  const [step, setStep] = useState(String(overview.maxStepPct));
  const [cooldown, setCooldown] = useState(String(overview.cooldownMinutes));

  useEffect(() => {
    setMode(overview.mode);
    setStep(String(overview.maxStepPct));
    setCooldown(String(overview.cooldownMinutes));
  }, [overview.mode, overview.maxStepPct, overview.cooldownMinutes]);

  const unapproved = (overview.zones ?? []).filter(z => (z.included || !overview.enabled) && !z.boundsApprovedAt);
  const dirty = mode !== overview.mode || step !== String(overview.maxStepPct) || cooldown !== String(overview.cooldownMinutes);

  return (
    <section aria-labelledby="mode-title" className="rounded-xl bg-kumo-base p-5 ring ring-kumo-line">
      <h2 id="mode-title" className="text-lg font-semibold text-kumo-strong">
        Chế độ định giá
      </h2>
      <div role="radiogroup" aria-labelledby="mode-title" className="mt-4 grid gap-3 md:grid-cols-3">
        {MODES.map(m => {
          const active = mode === m.mode;
          return (
            <label
              key={m.mode}
              className={`flex cursor-pointer gap-3 rounded-xl p-4 transition-colors ${
                active ? 'bg-kumo-tint ring-2 ring-violet-ink' : 'ring ring-kumo-line hover:bg-kumo-tint'
              }`}
            >
              <input type="radio" name="pricing-mode" checked={active} onChange={() => setMode(m.mode)} className="mt-1 accent-violet-ink" />
              <span>
                <span className="block font-semibold text-kumo-strong">{m.title}</span>
                <span className="mt-1 block text-sm text-kumo-subtle">{m.body}</span>
              </span>
            </label>
          );
        })}
      </div>

      {mode !== 'OFF' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Bước đổi giá tối đa mỗi lần (%)
            <input className="field mt-1.5 font-normal tabular-nums" inputMode="numeric" value={step} onChange={e => setStep(e.target.value)} />
          </label>
          <label className="field-label">
            Thời gian chờ giữa hai lần đổi giá (phút)
            <input className="field mt-1.5 font-normal tabular-nums" inputMode="numeric" value={cooldown} onChange={e => setCooldown(e.target.value)} />
          </label>
        </div>
      )}

      {mode === 'AUTO' && unapproved.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-kumo-warning-tint px-3 py-2 text-sm text-kumo-warning">
          <ShieldAlert className="mt-px size-4 flex-shrink-0" />
          Cần duyệt giá sàn, giá trần trước khi bật tự động: {unapproved.map(z => z.zoneName).join(', ')}. Dùng nút “Dùng sàn, trần đề xuất” hoặc
          lưu giá thủ công ở từng khu vực.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !dirty}
          onClick={() =>
            onSave({ enabled: mode !== 'OFF', autoAdjust: mode === 'AUTO', maxStepPct: Number(step), cooldownMinutes: Number(cooldown) })
          }
        >
          {busy ? 'Đang lưu...' : 'Lưu chế độ'}
        </button>
      </div>
    </section>
  );
};

const ActionChip: React.FC<{ z: ZonePricingView }> = ({ z }) => {
  const r = z.recommendation;
  if (r.insufficientData || r.salesClosed || r.soldOut) {
    return <span className="rounded-full bg-kumo-tint px-2.5 py-0.5 text-xs font-medium text-kumo-subtle">Chưa đề xuất</span>;
  }
  const styles = {
    INCREASE: { text: 'Tăng giá', icon: <ArrowUpRight className="size-3.5" />, cls: 'bg-kumo-success-tint text-kumo-success' },
    DECREASE: { text: 'Giảm giá', icon: <ArrowDownRight className="size-3.5" />, cls: 'bg-kumo-warning-tint text-kumo-warning' },
    MAINTAIN: { text: 'Giữ giá', icon: <ArrowRight className="size-3.5" />, cls: 'bg-kumo-tint text-kumo-default' }
  }[r.action];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.cls}`}>
      {styles.icon}
      {styles.text}
    </span>
  );
};

const ZoneCard: React.FC<{
  eventId: string;
  overview: PricingOverview;
  z: ZonePricingView;
  busyKey: string | null;
  run: (key: string, fn: () => Promise<unknown>, done: string) => void;
}> = ({ eventId, overview, z, busyKey, run }) => {
  const r = z.recommendation;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ base: String(z.basePrice), floor: String(z.floorPrice), ceiling: String(z.ceilingPrice) });
  const [formError, setFormError] = useState<string | null>(null);
  const busy = busyKey?.startsWith(z.zoneId) ?? false;
  const factors = [...(r.factors ?? [])].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).filter(f => Math.abs(f.effect) >= 0.01).slice(0, 3);

  useEffect(() => {
    if (!editing) setDraft({ base: String(z.basePrice), floor: String(z.floorPrice), ceiling: String(z.ceilingPrice) });
  }, [z.basePrice, z.floorPrice, z.ceilingPrice, editing]);

  const saveManual = (e: React.FormEvent) => {
    e.preventDefault();
    const [base, floor, ceiling] = [draft.base, draft.floor, draft.ceiling].map(v => v.trim());
    if (![base, floor, ceiling].every(v => /^\d+$/.test(v)) || !(Number(floor) <= Number(base) && Number(base) <= Number(ceiling))) {
      setFormError('Cần thỏa mãn: giá sàn ≤ giá đang bán ≤ giá trần, đều là số nguyên (VND).');
      return;
    }
    setFormError(null);
    run(
      `${z.zoneId}:manual`,
      async () => {
        const code = await apiUpdateZonePricing(eventId, z.zoneId, {
          basePrice: Number(base),
          floorPrice: Number(floor),
          ceilingPrice: Number(ceiling)
        });
        if (code) throw new Error(pricingErrorMessage(code));
        setEditing(false);
      },
      `Đã lưu giá khu ${z.zoneName}. Giá sàn, trần này được tính là đã duyệt.`
    );
  };

  const applySuggestedBounds = () =>
    run(
      `${z.zoneId}:bounds`,
      async () => {
        const code = await apiUpdateZonePricing(eventId, z.zoneId, {
          basePrice: z.basePrice,
          floorPrice: Math.min(r.suggestedFloor, z.basePrice),
          ceilingPrice: Math.max(r.suggestedCeiling, z.basePrice)
        });
        if (code) throw new Error(pricingErrorMessage(code));
      },
      `Đã duyệt giá sàn, trần cho khu ${z.zoneName}.`
    );

  let autoStatus: string | null = null;
  if (overview.mode === 'AUTO' && z.included) {
    autoStatus = z.autoBlockedBy
      ? AUTO_BLOCK_LABEL[z.autoBlockedBy] ?? z.autoBlockedBy
      : `Lần chạy tới sẽ tự động ${r.action === 'INCREASE' ? 'tăng' : 'giảm'} giá thành ${formatPrice(r.price)}.`;
  }

  return (
    <article id={`zone-${z.zoneId}`} aria-labelledby={`zone-title-${z.zoneId}`} className="scroll-mt-24 rounded-xl bg-kumo-base p-4 ring ring-kumo-line sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`zone-title-${z.zoneId}`} className="text-lg font-semibold tracking-tight text-kumo-strong">
            {z.zoneName}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-kumo-subtle">
            <span>{z.zoneCode}</span>
            {z.boundsApprovedAt ? (
              <span className="inline-flex items-center gap-1 text-kumo-success">
                <ShieldCheck className="size-3.5" /> Đã duyệt sàn, trần
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-kumo-warning">
                <ShieldAlert className="size-3.5" /> Chưa duyệt sàn, trần
              </span>
            )}
          </p>
        </div>
        {overview.enabled && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-kumo-default">
            <input
              type="checkbox"
              checked={z.included}
              disabled={busy}
              onChange={e =>
                run(
                  `${z.zoneId}:include`,
                  () => setZoneIncluded(eventId, z.zoneId, e.target.checked),
                  e.target.checked ? `Khu ${z.zoneName} tham gia định giá động.` : `Khu ${z.zoneName} không còn tham gia định giá động.`
                )
              }
              className="size-4 accent-violet-ink"
            />
            Tham gia định giá động
          </label>
        )}
      </header>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <section aria-label="Giá đang áp dụng" className="rounded-lg bg-kumo-recessed p-4">
          <p className="text-xs font-medium text-kumo-subtle">Giá đang bán</p>
          <p className="type-figure mt-1 text-2xl text-kumo-strong tabular-nums">{formatPrice(z.basePrice)}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-kumo-subtle">Sàn – trần</dt>
              <dd className="tabular-nums text-kumo-default">
                {formatPriceShort(z.floorPrice)} – {formatPriceShort(z.ceilingPrice)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-kumo-subtle">Giá niêm yết</dt>
              <dd className="tabular-nums text-kumo-default">{formatPriceShort(z.listPrice)}</dd>
            </div>
            {z.lastChangeAt && (
              <div className="flex justify-between gap-2">
                <dt className="text-kumo-subtle">Đổi lần cuối</dt>
                <dd className="tabular-nums text-kumo-default">{timeOf(z.lastChangeAt)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section aria-label="Đề xuất của AI" className="rounded-lg border border-dashed border-violet-ink/50 p-4">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-ink">
              <Sparkles className="size-3.5" /> AI đề xuất · chưa áp dụng
            </span>
            <ActionChip z={z} />
          </p>
          {!r.insufficientData && !r.salesClosed && !r.soldOut && (
            <>
              <p className="type-figure mt-2 text-2xl text-kumo-strong tabular-nums">{formatPrice(r.price)}</p>
              <p className="text-xs text-kumo-subtle tabular-nums">
                Khoảng hợp lý {formatPriceShort(r.rangeLow)} – {formatPriceShort(r.rangeHigh)}
              </p>
            </>
          )}
          <p className="mt-2 text-sm text-kumo-default">{r.explanation}</p>
          {factors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-kumo-subtle">
              {factors.map(f => (
                <li key={f.key} className="flex items-start gap-1.5">
                  {f.effect > 0 ? (
                    <ArrowUpRight className="mt-px size-3.5 flex-shrink-0 text-kumo-success" aria-label="đẩy giá lên" />
                  ) : (
                    <ArrowDownRight className="mt-px size-3.5 flex-shrink-0 text-kumo-warning" aria-label="kéo giá xuống" />
                  )}
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-kumo-hairline pt-3 text-xs">
            <p className="text-kumo-subtle">
              Sàn, trần đề xuất:{' '}
              <span className="tabular-nums text-kumo-default">
                {formatPriceShort(r.suggestedFloor)} – {formatPriceShort(r.suggestedCeiling)}
              </span>
            </p>
            <button type="button" className="btn btn-quiet btn-sm mt-1 -ml-3" disabled={busy} onClick={applySuggestedBounds}>
              Dùng sàn, trần đề xuất
            </button>
          </div>
        </section>

        <section aria-label="Tồn kho và tốc độ bán" className="rounded-lg p-4 ring ring-kumo-line">
          <p className="mb-2 text-xs font-medium text-kumo-subtle">Tồn kho · {z.capacity} chỗ</p>
          <InventoryBar counts={z} />
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-kumo-subtle">Nhu cầu</dt>
              <dd className="text-kumo-default">{r.insufficientData ? 'Chưa rõ' : DEMAND_LABEL[r.demandLevel]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-kumo-subtle">So với kế hoạch</dt>
              <dd className="tabular-nums text-kumo-default">
                {pct(r.actualShare)} / {pct(r.expectedShare)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-kumo-subtle">Tốc độ / cần</dt>
              <dd className="tabular-nums text-kumo-default">
                {r.velocity.toFixed(1)} / {r.requiredVelocity.toFixed(1)} vé/giờ
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-kumo-subtle">Giữ ghế 1h · 24h</dt>
              <dd className="tabular-nums text-kumo-default">
                {z.holds1h} · {z.holds24h}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-kumo-subtle">Độ tin cậy</dt>
              <dd className="tabular-nums text-kumo-default">{pct(r.confidence)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className="mt-4 flex flex-col gap-3 border-t border-kumo-hairline pt-4">
        {overview.mode === 'MANUAL' && z.pending && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-ink"
              disabled={busy}
              onClick={() => run(`${z.zoneId}:approve`, () => approveSuggestion(z.pending!.id), `Đã áp dụng giá ${formatPrice(z.pending!.suggestedPrice)} cho khu ${z.zoneName}.`)}
            >
              <CheckCircle2 className="size-4" />
              Áp dụng {formatPrice(z.pending.suggestedPrice)}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => run(`${z.zoneId}:reject`, () => rejectSuggestion(z.pending!.id), `Đã bỏ qua đề xuất cho khu ${z.zoneName}.`)}
            >
              Bỏ qua
            </button>
          </div>
        )}
        {autoStatus && (
          <p className="flex items-start gap-2 text-sm text-kumo-info">
            <Zap className="mt-px size-4 flex-shrink-0" />
            {autoStatus}
          </p>
        )}

        {editing ? (
          <form onSubmit={saveManual} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['floor', 'Giá sàn'],
                  ['base', 'Giá đang bán'],
                  ['ceiling', 'Giá trần']
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="field-label">
                  {label}
                  <input
                    className="field mt-1.5 font-normal tabular-nums"
                    inputMode="numeric"
                    value={draft[key]}
                    onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {overview.mode === 'AUTO' && (
              <p className="text-xs text-kumo-subtle">
                Sau khi bạn đổi giá, chế độ tự động chờ ít nhất {overview.cooldownMinutes} phút mới đổi lại.
              </p>
            )}
            {formError && <Banner tone="error">{formError}</Banner>}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-ink" disabled={busy}>
                Lưu giá thủ công
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>
                Hủy
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm self-start" onClick={() => setEditing(true)}>
            Đổi giá thủ công
          </button>
        )}
      </footer>
    </article>
  );
};

const AlertsPanel: React.FC<{
  eventId: string;
  alerts: PricingAlert[];
  run: (key: string, fn: () => Promise<unknown>, done: string) => void;
}> = ({ eventId, alerts, run }) => {
  const unread = alerts.filter(a => !a.read).length;
  return (
    <section aria-labelledby="alerts-title" className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
      <div className="flex items-center justify-between gap-2">
        <h2 id="alerts-title" className="flex items-center gap-2 text-base font-semibold text-kumo-strong">
          <Bell className="size-4" /> Thông báo
          {unread > 0 && <span className="rounded-full bg-kumo-danger px-2 text-xs font-semibold text-white tabular-nums">{unread}</span>}
        </h2>
        {unread > 0 && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => run('alerts:all', () => markAllAlertsRead(eventId), '')}>
            Đọc hết
          </button>
        )}
      </div>
      {alerts.length === 0 ? (
        <p className="mt-3 text-sm text-kumo-subtle">Chưa có thông báo nào.</p>
      ) : (
        <ul className="mt-3 max-h-[32rem] space-y-2 overflow-auto pr-1">
          {alerts.map(a => {
            const meta = ALERT_LABEL[a.kind] ?? { label: a.kind, tone: 'text-kumo-subtle', icon: <Bell className="size-4" /> };
            return (
              <li key={a.id} className={`rounded-lg p-3 text-sm ${a.read ? 'ring ring-kumo-hairline' : 'bg-kumo-tint ring ring-kumo-line'}`}>
                <p className={`flex items-center gap-1.5 text-xs font-semibold ${meta.tone}`}>
                  {meta.icon}
                  {meta.label}
                  <span className="ml-auto font-normal text-kumo-subtle tabular-nums">{timeOf(a.createdAt)}</span>
                </p>
                <p className="mt-1 text-kumo-default">{a.message}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs">
                  {a.zoneId && (
                    <a href={`#zone-${a.zoneId}`} className="font-medium text-violet-ink hover:underline">
                      Xem khu {a.zoneCode}
                    </a>
                  )}
                  {!a.read && (
                    <button type="button" className="text-kumo-subtle hover:text-kumo-strong" onClick={() => run(`alert:${a.id}`, () => markAlertRead(a.id), '')}>
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const HistorySection: React.FC<{ overview: PricingOverview; history: PriceChange[] }> = ({ overview, history }) => {
  const zones = overview.zones ?? [];
  const [zoneId, setZoneId] = useState(() => history[0]?.zoneId ?? zones[0]?.zoneId ?? '');
  const zone = zones.find(z => z.zoneId === zoneId);

  // A step line of the zone's price: its first logged price, then every change, up to now.
  const series = useMemo(() => {
    if (!zone) return [];
    const changes = history.filter(h => h.zoneId === zoneId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const start = Math.min(Date.parse(overview.salesOpenAt), ...changes.map(c => Date.parse(c.createdAt)));
    const points = [{ x: start, y: changes[0]?.oldPrice ?? zone.basePrice }, ...changes.map(c => ({ x: Date.parse(c.createdAt), y: c.newPrice }))];
    points.push({ x: Math.max(Date.now(), points[points.length - 1].x), y: zone.basePrice });
    return [{ key: 'price', label: 'Giá', color: SERIES_COLORS[0], points, step: true }];
  }, [history, zone, zoneId, overview.salesOpenAt]);

  return (
    <section aria-labelledby="history-title" className="rounded-xl bg-kumo-base p-5 ring ring-kumo-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-title" className="text-lg font-semibold text-kumo-strong">
          Lịch sử giá
        </h2>
        <label className="flex items-center gap-2 text-sm text-kumo-subtle">
          Khu vực
          <select className="field h-10 w-auto py-0" value={zoneId} onChange={e => setZoneId(e.target.value)}>
            {zones.map(z => (
              <option key={z.zoneId} value={z.zoneId}>
                {z.zoneName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {zone && (
        <div className="mt-4">
          <LineChart
            title={`Giá khu ${zone.zoneName}`}
            series={series}
            zeroBased={false}
            guides={[
              { y: zone.floorPrice, label: 'Sàn' },
              { y: zone.ceilingPrice, label: 'Trần' }
            ]}
            formatX={x => timeOf(new Date(x).toISOString())}
            formatY={formatPriceShort}
          />
        </div>
      )}

      {history.length === 0 ? (
        <p className="mt-4 text-sm text-kumo-subtle">Chưa có lần đổi giá nào.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg ring ring-kumo-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-kumo-recessed text-xs text-kumo-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Thời điểm</th>
                <th className="px-3 py-2 font-medium">Khu vực</th>
                <th className="px-3 py-2 text-right font-medium">Giá cũ → mới</th>
                <th className="px-3 py-2 font-medium">Nguồn</th>
                <th className="px-3 py-2 font-medium">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-t border-kumo-hairline align-top">
                  <td className="px-3 py-2 text-kumo-subtle tabular-nums">{timeOf(h.createdAt)}</td>
                  <td className="px-3 py-2 text-kumo-default">{h.zoneName}</td>
                  <td className="px-3 py-2 text-right text-kumo-strong tabular-nums">
                    {formatPriceShort(h.oldPrice)} → {formatPriceShort(h.newPrice)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        h.trigger === 'AUTO' ? 'bg-kumo-info-tint text-kumo-info' : h.trigger === 'SUGGESTION' ? 'bg-violet/12 text-violet-ink' : 'bg-kumo-tint text-kumo-default'
                      }`}
                    >
                      {TRIGGER_LABEL[h.trigger] ?? h.trigger}
                    </span>
                    <span className="mt-1 block text-xs text-kumo-subtle">{h.trigger === 'AUTO' ? 'Hệ thống' : h.changedByName || 'Ban tổ chức'}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-kumo-subtle">{h.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/** The old standalone address now opens the event's Tickets & pricing tab. */
export const PricingPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  return <Navigate to={`/organizer/events/${id}?tab=pricing`} replace />;
};

/**
 * Dynamic pricing for one event: mode, recommendations per zone, alerts and
 * price history. onChange runs after every reload, so the surrounding page can
 * refresh prices and alert counts it shows elsewhere.
 */
export const PricingPanel: React.FC<{ eventId: string; onChange?: () => void }> = ({ eventId: id, onChange }) => {
  const [overview, setOverview] = useState<PricingOverview | null>(null);
  const [alerts, setAlerts] = useState<PricingAlert[]>([]);
  const [history, setHistory] = useState<PriceChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const reload = useCallback(async () => {
    try {
      const [o, a, h] = await Promise.all([fetchPricingOverview(id), fetchPricingAlerts(id), fetchPriceHistory(id)]);
      setOverview(o);
      setAlerts(a ?? []);
      setHistory(h ?? []);
      onChangeRef.current?.();
    } catch (e) {
      setError(pricingError(e));
    }
  }, [id]);

  // Alerts arrive in bursts during a pricing run; reload once per burst.
  const pending = useRef<number | undefined>(undefined);
  const scheduleReload = useCallback(() => {
    window.clearTimeout(pending.current);
    pending.current = window.setTimeout(reload, 400);
  }, [reload]);

  useEffect(() => {
    if (!id) return;
    reload();
    const close = subscribePricing(id, scheduleReload);
    // Sales speed changes with time even without new events.
    const timer = window.setInterval(reload, 60_000);
    return () => {
      close();
      window.clearInterval(timer);
      window.clearTimeout(pending.current);
    };
  }, [id, reload, scheduleReload]);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, done: string) => {
      setBusyKey(key);
      setError(null);
      setNotice(null);
      try {
        await fn();
        if (done) setNotice(done);
        await reload();
      } catch (e) {
        setError(e instanceof Error && !e.message.match(/^[a-z_0-9]+$/) ? e.message : pricingError(e));
      } finally {
        setBusyKey(null);
      }
    },
    [reload]
  );

  const totals = useMemo(() => {
    const zones = overview?.zones ?? [];
    const sum = (f: (z: ZonePricingView) => number) => zones.reduce((n, z) => n + f(z), 0);
    return {
      available: sum(z => z.available),
      held: sum(z => z.held),
      sold: sum(z => z.sold),
      holds24h: sum(z => z.holds24h),
      velocity: sum(z => z.recommendation.velocity),
      capacity: sum(z => z.capacity)
    };
  }, [overview]);

  const demandSeries = useMemo(() => {
    const d = overview?.demand ?? [];
    const pts = (f: (p: (typeof d)[number]) => number) => d.map(p => ({ x: Date.parse(p.at), y: f(p) }));
    return [
      { key: 'views', label: 'Lượt xem', color: SERIES_COLORS[0], points: pts(p => p.views) },
      { key: 'holds', label: 'Giữ ghế', color: SERIES_COLORS[1], points: pts(p => p.holds) },
      { key: 'sales', label: 'Vé bán', color: SERIES_COLORS[2], points: pts(p => p.sales) }
    ];
  }, [overview]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-kumo-strong">Định giá động</h2>
        {overview && overview.mode !== 'OFF' && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busyKey === 'analyze'}
            onClick={() => run('analyze', () => analyzePricingNow(id), 'Đã phân tích lại toàn bộ khu vực.')}
          >
            <RefreshCw className={`size-4 ${busyKey === 'analyze' ? 'animate-spin' : ''}`} />
            Phân tích ngay
          </button>
        )}
      </div>

        <div className="mt-4 space-y-2" aria-live="polite">
          {error && <Banner tone="error">{error}</Banner>}
          {notice && <Banner tone="ok">{notice}</Banner>}
        </div>

        {overview && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-kumo-subtle">
              <span>
                Trạng thái:{' '}
                <strong className="text-kumo-strong">
                  {overview.mode === 'OFF' ? 'Đang tắt' : overview.mode === 'AUTO' ? 'Đang bật · Tự động' : 'Đang bật · Thủ công, AI đề xuất'}
                </strong>
              </span>
              <span>Mở bán {timeOf(overview.salesOpenAt)} · đóng bán {timeOf(overview.salesCloseAt)}</span>
              <span>Phân tích lúc {timeOf(overview.analyzedAt)}</span>
              {!overview.paymentsLive && <span>Chưa bật thanh toán: nhu cầu ước tính từ lượt giữ ghế.</span>}
            </div>

            <ModeCard
              overview={overview}
              busy={busyKey === 'settings'}
              onSave={s =>
                run('settings', () => savePricingSettings(id, s), s.enabled ? (s.autoAdjust ? 'Đã bật định giá tự động.' : 'Đã bật chế độ thủ công có đề xuất.') : 'Đã tắt định giá động.')
              }
            />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Còn trống" value={String(totals.available)} note={`trên ${totals.capacity} chỗ`} />
              <Stat label="Đang giữ" value={String(totals.held)} />
              <Stat label="Đã bán" value={String(totals.sold)} />
              <Stat label="Giữ ghế 24 giờ" value={String(totals.holds24h)} />
              <Stat label="Tốc độ ước tính" value={totals.velocity.toFixed(1)} note="vé mỗi giờ" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
              <div className="space-y-4 lg:col-span-2">
                <section className="rounded-xl bg-kumo-base p-5 ring ring-kumo-line">
                  <LineChart
                    title="Quan tâm và đặt vé theo giờ, 48 giờ qua"
                    series={demandSeries}
                    formatX={x => timeOf(new Date(x).toISOString())}
                    formatY={y => String(Math.round(y))}
                  />
                </section>
                <h2 className="pt-2 text-lg font-semibold text-kumo-strong">Theo khu vực</h2>
                {(overview.zones ?? []).map(z => (
                  <ZoneCard key={z.zoneId} eventId={id} overview={overview} z={z} busyKey={busyKey} run={run} />
                ))}
              </div>
              <div className="lg:sticky lg:top-24">
                <AlertsPanel eventId={id} alerts={alerts} run={run} />
              </div>
            </div>

            <HistorySection overview={overview} history={history} />
          </div>
        )}
    </div>
  );
};
