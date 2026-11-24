import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Palette, RotateCcw, Save } from 'lucide-react';
import { SeatItem, StageLayoutConfig } from '../../types';
import { EventSalesSummary, apiUpdateEventLayout, pricingErrorMessage } from '../../services/organizerService';
import { PRICE_BAND_COLORS, ZoneSummary, normalizeLayoutConfig } from '../../services/venue';
import { StageDesignerControls } from './StageDesignerControls';
import { StageLayoutPreview } from './StageLayoutPreview';

const ZONE_SWATCHES = ['#f2c982', '#f4a782', '#e38c95', '#c37aac', '#9470b9', '#5a6bb5', '#34d399', '#38bdf8'];

interface StageLayoutEditorPanelProps {
  summary: EventSalesSummary;
  seats: SeatItem[];
  onSaved: (nextConfig: StageLayoutConfig) => void;
}

export const StageLayoutEditorPanel: React.FC<StageLayoutEditorPanelProps> = ({ summary, seats, onSaved }) => {
  const [draft, setDraft] = useState<StageLayoutConfig>(() => normalizeLayoutConfig(summary.layoutConfig));
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(summary.zones[0]?.zoneId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(normalizeLayoutConfig(summary.layoutConfig));
    setSelectedZoneId(summary.zones[0]?.zoneId ?? null);
    setError(null);
    setSaved(false);
  }, [summary.eventId, summary.layoutConfig]);

  const previewZones: ZoneSummary[] = useMemo(() => {
    const ordered = [...summary.zones].sort((a, b) => b.basePrice - a.basePrice);
    const lastRank = Math.max(1, ordered.length - 1);
    const styles = draft.zoneStyles ?? {};
    return ordered.map((z, rank) => {
      const band = Math.round((rank / lastRank) * (PRICE_BAND_COLORS.length - 1));
      const custom = styles[z.zoneCode.toUpperCase()]?.color ?? styles[z.zoneCode]?.color;
      return {
        id: z.zoneId,
        code: z.zoneCode,
        name: z.zoneName,
        shortName: z.zoneName.replace(/\s*\([^)]*\)\s*$/, '').trim() || z.zoneName,
        kind: z.kind,
        basePrice: z.basePrice,
        priceFrom: z.basePrice,
        capacity: z.capacity,
        available: z.available,
        rank,
        band,
        color: custom || PRICE_BAND_COLORS[band]
      };
    });
  }, [summary.zones, draft.zoneStyles]);

  const setZoneColor = (zoneCode: string, color: string) => {
    const code = zoneCode.toUpperCase();
    setSaved(false);
    setDraft(prev => ({
      ...prev,
      zoneStyles: {
        ...(prev.zoneStyles ?? {}),
        [code]: {
          ...(prev.zoneStyles?.[code] ?? {}),
          color
        }
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    const res = await apiUpdateEventLayout(summary.eventId, draft);
    setIsSaving(false);
    if (res.error || !res.layoutConfig) {
      setError(pricingErrorMessage(res.error ?? 'unknown'));
      return;
    }
    setDraft(res.layoutConfig);
    setSaved(true);
    onSaved(res.layoutConfig);
  };

  const handleReset = () => {
    setDraft(normalizeLayoutConfig(undefined));
    setSaved(false);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <StageLayoutPreview
        zones={previewZones}
        seats={seats}
        layoutConfig={draft}
        selectedZoneId={selectedZoneId}
        onSelectZone={setSelectedZoneId}
        title={`Thiết kế sân khấu · ${summary.eventName}`}
        compact
      />

      <div className="rounded-2xl bg-kumo-base p-4 ring ring-kumo-line sm:p-5 space-y-5">
        <StageDesignerControls
          value={draft}
          onChange={next => {
            setSaved(false);
            setDraft(next);
          }}
        />

        {/* Zone Color Customization */}
        {previewZones.length > 0 && (
          <div className="border-t border-kumo-hairline pt-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-kumo-subtle">
              <Palette className="size-3.5 text-violet-ink" />
              Màu hiển thị từng khu vực
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {previewZones.map(z => (
                <div
                  key={z.id}
                  onClick={() => setSelectedZoneId(z.id)}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition-colors ${
                    selectedZoneId === z.id
                      ? 'bg-kumo-tint ring ring-violet-ink/60'
                      : 'bg-kumo-recessed/60 ring ring-kumo-line/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-kumo-strong">{z.name}</p>
                    <p className="text-[11px] text-kumo-subtle">
                      {z.code} · {z.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {ZONE_SWATCHES.map(hex => (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Chọn màu ${hex} cho ${z.name}`}
                        onClick={e => {
                          e.stopPropagation();
                          setZoneColor(z.code, hex);
                        }}
                        className={`size-4 rounded-full transition-transform ${
                          z.color.toLowerCase() === hex.toLowerCase()
                            ? 'scale-110 ring-2 ring-kumo-strong ring-offset-1 ring-offset-kumo-base'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleSave} disabled={isSaving} className="btn btn-ink btn-sm h-10">
              <Save className="size-4" />
              <span>{isSaving ? 'Đang lưu thiết kế...' : 'Lưu thiết kế sân khấu'}</span>
            </button>
            <button type="button" onClick={handleReset} className="btn btn-secondary btn-sm h-10">
              <RotateCcw className="size-3.5" />
              <span>Về mặc định</span>
            </button>
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 rounded-lg bg-kumo-danger-tint px-3 py-1.5 text-xs text-kumo-danger">
              <AlertCircle className="size-3.5 shrink-0" />
              {error}
            </p>
          )}
          {saved && !error && (
            <p role="status" className="flex items-center gap-1.5 rounded-lg bg-kumo-success-tint px-3 py-1.5 text-xs text-kumo-success">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Đã lưu bố cục sân khấu (đồng bộ 2D &amp; 3D)
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
