import React from 'react';
import { LayoutStyle, StageLayoutConfig, StageShape, StageTheme } from '../../types';
import { STAGE_THEMES, normalizeLayoutConfig } from '../../services/venue';

const STAGE_SHAPES: {
  id: StageShape;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'standard',
    label: 'Sân khấu chuẩn',
    desc: 'Mặt tiền cổ điển',
    icon: (
      <svg viewBox="0 0 40 28" className="h-7 w-10">
        <rect x="7" y="4" width="26" height="9" rx="2" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 20 Q20 26 34 20" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'thrust',
    label: 'Chữ T (Thrust)',
    desc: 'Đường băng + B-Stage',
    icon: (
      <svg viewBox="0 0 40 28" className="h-7 w-10">
        <path
          d="M7 3 H33 V10 H23 V18 H28 V24 H12 V18 H17 V10 H7 Z"
          fill="currentColor"
          fillOpacity="0.28"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    id: 'catwalk',
    label: 'Catwalk Runway',
    desc: 'Đường băng kéo dài',
    icon: (
      <svg viewBox="0 0 40 28" className="h-7 w-10">
        <path
          d="M7 3 H33 V10 H23 V25 H17 V10 H7 Z"
          fill="currentColor"
          fillOpacity="0.28"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    id: 'center',
    label: 'Trung tâm 360°',
    desc: 'Sân khấu đảo trung tâm',
    icon: (
      <svg viewBox="0 0 40 28" className="h-7 w-10">
        <circle cx="20" cy="14" r="11" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="14" y="8" width="12" height="12" rx="2.5" fill="currentColor" fillOpacity="0.32" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
];

const LAYOUT_STYLES: {
  id: LayoutStyle;
  label: string;
  desc: string;
  spanDeg: number;
  zonesPerRing: number;
}[] = [
  { id: 'horseshoe', label: 'Vòng cung Stadium', desc: '150° · 3 khu/tầng', spanDeg: 150, zonesPerRing: 3 },
  { id: 'theater', label: 'Nhà hát đối diện', desc: '92° · 2 khu/tầng', spanDeg: 92, zonesPerRing: 2 },
  { id: 'amphitheater', label: 'Đấu trường rộng', desc: '198° · 4 khu/tầng', spanDeg: 198, zonesPerRing: 4 },
  { id: 'arena360', label: 'Bao quanh 360°', desc: '310° · 4 khu/tầng', spanDeg: 310, zonesPerRing: 4 }
];

interface StageDesignerControlsProps {
  value: StageLayoutConfig;
  onChange: (next: StageLayoutConfig) => void;
}

export const StageDesignerControls: React.FC<StageDesignerControlsProps> = ({ value, onChange }) => {
  const cfg = normalizeLayoutConfig(value);
  const showRunway = cfg.stageShape === 'thrust' || cfg.stageShape === 'catwalk';

  const patch = (partial: Partial<StageLayoutConfig>) => {
    onChange({
      ...cfg,
      ...partial
    });
  };

  const handleStageShape = (shape: StageShape) => {
    const next: Partial<StageLayoutConfig> = { stageShape: shape };
    if (shape === 'center') {
      next.layoutStyle = 'arena360';
      next.tierSpanDeg = 310;
      next.zonesPerRing = 4;
      next.stageWidth = Math.min(cfg.stageWidth, 12);
      next.stageDepth = 10;
    } else {
      if (cfg.stageShape === 'center') {
        next.layoutStyle = 'horseshoe';
        next.tierSpanDeg = 150;
        next.zonesPerRing = 3;
        next.stageWidth = 16;
        next.stageDepth = 6;
      }
      if (shape === 'thrust' || shape === 'catwalk') {
        next.catwalkLength = cfg.catwalkLength || 7.5;
        next.catwalkWidth = cfg.catwalkWidth || 3.4;
      }
    }
    patch(next);
  };

  const handleLayoutStyle = (preset: (typeof LAYOUT_STYLES)[number]) => {
    patch({
      layoutStyle: preset.id,
      tierSpanDeg: preset.spanDeg,
      zonesPerRing: preset.zonesPerRing,
      ...(preset.id === 'arena360' && cfg.stageShape === 'standard' ? { stageShape: 'center', stageWidth: 11, stageDepth: 10 } : {})
    });
  };

  return (
    <div className="space-y-5">
      {/* Stage Shape */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kumo-subtle">Kiểu sân khấu</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {STAGE_SHAPES.map(shape => {
            const active = cfg.stageShape === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => handleStageShape(shape.id)}
                className={`flex flex-col items-center rounded-xl p-3 text-center transition-all ${
                  active
                    ? 'bg-kumo-tint text-violet-ink ring-2 ring-violet-ink'
                    : 'bg-kumo-base text-kumo-default ring ring-kumo-line hover:ring-kumo-interact'
                }`}
              >
                <div className="mb-1.5">{shape.icon}</div>
                <span className="text-xs font-semibold text-kumo-strong">{shape.label}</span>
                <span className="mt-0.5 text-[11px] text-kumo-subtle">{shape.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Venue Audience Layout Style */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kumo-subtle">Bố cục khán đài</p>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUT_STYLES.map(preset => {
            const active = cfg.layoutStyle === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLayoutStyle(preset)}
                className={`rounded-xl px-3 py-2.5 text-left transition-all ${
                  active
                    ? 'bg-kumo-tint ring-2 ring-violet-ink'
                    : 'bg-kumo-base ring ring-kumo-line hover:ring-kumo-interact'
                }`}
              >
                <p className="text-xs font-semibold text-kumo-strong">{preset.label}</p>
                <p className="mt-0.5 text-[11px] text-kumo-subtle">{preset.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage Theme & Custom Label */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kumo-subtle">Ánh sáng &amp; LED sân khấu</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(STAGE_THEMES) as StageTheme[]).map(key => {
              const t = STAGE_THEMES[key];
              const active = cfg.stageTheme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch({ stageTheme: key })}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-all ${
                    active
                      ? 'bg-kumo-tint font-semibold text-kumo-strong ring-2 ring-violet-ink'
                      : 'bg-kumo-base text-kumo-default ring ring-kumo-line hover:ring-kumo-interact'
                  }`}
                >
                  <span
                    className="size-4 shrink-0 rounded-full ring-1 ring-black/15"
                    style={{
                      background: `linear-gradient(135deg, ${t.ledStops[0]}, ${t.ledStops[1]}, ${t.ledStops[2]})`
                    }}
                  />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-kumo-subtle">
            Nhãn hiển thị trên sân khấu
          </span>
          <input
            type="text"
            maxLength={36}
            value={value.stageLabel ?? cfg.stageLabel}
            onChange={e => patch({ stageLabel: e.target.value })}
            placeholder="SÂN KHẤU CHÍNH"
            className="field"
          />
          <span className="mt-1 block text-[11px] text-kumo-subtle">
            Hiển thị trên bản đồ 2D, bản đồ nhiệt doanh số và phòng vé.
          </span>
        </label>
      </div>

      {/* Dimension & Layout Sliders */}
      <div className="rounded-xl bg-kumo-recessed/55 p-4 ring ring-kumo-line/75">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-kumo-subtle">
          Tùy chỉnh kích thước &amp; hình học
        </p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="block text-xs text-kumo-default">
            <span className="flex justify-between">
              <span>Chiều rộng sân khấu</span>
              <strong className="tabular-nums text-kumo-strong">{cfg.stageWidth}m</strong>
            </span>
            <input
              type="range"
              min={8}
              max={24}
              step={1}
              value={cfg.stageWidth}
              onChange={e => patch({ stageWidth: Number(e.target.value) })}
              className="mt-1.5 w-full accent-violet-ink"
            />
          </label>

          <label className="block text-xs text-kumo-default">
            <span className="flex justify-between">
              <span>Chiều sâu sân khấu</span>
              <strong className="tabular-nums text-kumo-strong">{cfg.stageDepth}m</strong>
            </span>
            <input
              type="range"
              min={4}
              max={12}
              step={0.5}
              value={cfg.stageDepth}
              onChange={e => patch({ stageDepth: Number(e.target.value) })}
              className="mt-1.5 w-full accent-violet-ink"
            />
          </label>

          <label className="block text-xs text-kumo-default">
            <span className="flex justify-between">
              <span>Chiều cao sàn sân khấu (3D)</span>
              <strong className="tabular-nums text-kumo-strong">{cfg.stageHeight.toFixed(1)}m</strong>
            </span>
            <input
              type="range"
              min={0.8}
              max={2.4}
              step={0.2}
              value={cfg.stageHeight}
              onChange={e => patch({ stageHeight: Number(e.target.value) })}
              className="mt-1.5 w-full accent-violet-ink"
            />
          </label>

          <label className="block text-xs text-kumo-default">
            <span className="flex justify-between">
              <span>Góc vòng cung khán đài</span>
              <strong className="tabular-nums text-kumo-strong">{Math.round(cfg.tierSpanDeg)}°</strong>
            </span>
            <input
              type="range"
              min={75}
              max={315}
              step={5}
              value={cfg.tierSpanDeg}
              onChange={e => patch({ tierSpanDeg: Number(e.target.value) })}
              className="mt-1.5 w-full accent-violet-ink"
            />
          </label>

          <label className="block text-xs text-kumo-default">
            <span className="flex justify-between">
              <span>Số khu ngồi mỗi tầng</span>
              <strong className="tabular-nums text-kumo-strong">{cfg.zonesPerRing} khu</strong>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={cfg.zonesPerRing}
              onChange={e => patch({ zonesPerRing: Number(e.target.value) })}
              className="mt-1.5 w-full accent-violet-ink"
            />
          </label>

          <label className="block text-xs text-kumo-default">
            <span className="flex justify-between">
              <span>Độ rộng khu đứng (Pit)</span>
              <strong className="tabular-nums text-kumo-strong">{cfg.pitWidth}m</strong>
            </span>
            <input
              type="range"
              min={10}
              max={24}
              step={1}
              value={cfg.pitWidth}
              onChange={e => patch({ pitWidth: Number(e.target.value) })}
              className="mt-1.5 w-full accent-violet-ink"
            />
          </label>

          {showRunway && (
            <>
              <label className="block text-xs text-kumo-default">
                <span className="flex justify-between">
                  <span>Chiều dài đường băng (Runway)</span>
                  <strong className="tabular-nums text-kumo-strong">{cfg.catwalkLength.toFixed(1)}m</strong>
                </span>
                <input
                  type="range"
                  min={4}
                  max={13}
                  step={0.5}
                  value={cfg.catwalkLength}
                  onChange={e => patch({ catwalkLength: Number(e.target.value) })}
                  className="mt-1.5 w-full accent-violet-ink"
                />
              </label>

              <label className="block text-xs text-kumo-default">
                <span className="flex justify-between">
                  <span>Bề rộng đường băng</span>
                  <strong className="tabular-nums text-kumo-strong">{cfg.catwalkWidth.toFixed(1)}m</strong>
                </span>
                <input
                  type="range"
                  min={2.5}
                  max={5.5}
                  step={0.5}
                  value={cfg.catwalkWidth}
                  onChange={e => patch({ catwalkWidth: Number(e.target.value) })}
                  className="mt-1.5 w-full accent-violet-ink"
                />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
