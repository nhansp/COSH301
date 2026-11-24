import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Flame, MapPin, Sparkles, Ticket } from 'lucide-react';
import {
  EnrichedEvent,
  RecommendedEvent,
  UserPreferences
} from '../../services/assistantService';
import { formatPrice, formatPriceShort } from '../../services/eventService';
import { ZoneKind } from '../../types';

interface EventBriefCardProps {
  events: EnrichedEvent[];
  focusSingle: boolean;
  onAskSingle?: (title: string) => void;
}

export const EventBriefCard: React.FC<EventBriefCardProps> = ({ events, focusSingle, onAskSingle }) => {
  if (focusSingle && events[0]) {
    const item = events[0];
    const standing = item.zones.filter(z => z.kind === 'standing').length;
    const seated = item.zones.length - standing;

    return (
      <div className="mt-2.5 overflow-hidden rounded-2xl bg-kumo-base ring ring-kumo-line">
        <div className="relative h-28 bg-midnight">
          <img
            src={item.event.imageUrl}
            alt={item.event.title}
            referrerPolicy="no-referrer"
            className="size-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-transparent" />
          <div className="absolute inset-x-3 bottom-2.5">
            <span className="inline-flex rounded-full bg-violet/90 px-2 py-0.5 text-[11px] font-semibold text-midnight">
              {item.event.genre}
            </span>
            <h4 className="type-display mt-1 line-clamp-1 text-base text-white">{item.event.title}</h4>
          </div>
        </div>

        <div className="space-y-2.5 p-3">
          <p className="text-xs leading-relaxed text-kumo-default">{item.event.description}</p>

          <div className="grid grid-cols-2 gap-1.5 text-xs text-kumo-subtle">
            <span className="flex items-center gap-1.5 truncate">
              <CalendarDays className="size-3.5 shrink-0 text-violet-ink" />
              <span className="truncate">{item.event.date}</span>
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5 shrink-0 text-violet-ink" />
              <span className="truncate">{item.event.city}</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-kumo-recessed p-2 text-center">
            <div>
              <span className="block text-[10px] text-kumo-subtle">Khoảng giá</span>
              <span className="type-figure text-xs text-kumo-strong">
                {formatPriceShort(item.minPrice)}–{formatPriceShort(item.maxPrice)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-kumo-subtle">Khu vực</span>
              <span className="type-figure text-xs text-kumo-strong">
                {seated} ngồi · {standing} đứng
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-kumo-subtle">Còn trống</span>
              <span className="type-figure text-xs text-kumo-success">
                {item.availableSeats}/{item.totalSeats}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Link to={`/events/${item.event.id}`} className="btn btn-secondary btn-sm h-8 flex-1 text-xs">
              Chi tiết
            </Link>
            <Link to={`/events/${item.event.id}/tickets`} className="btn btn-primary btn-sm h-8 flex-1 text-xs">
              <Ticket className="size-3.5" />
              Chọn ghế
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-2.5 space-y-2">
      {events.map(item => (
        <li
          key={item.event.id}
          className="flex items-center gap-2.5 rounded-xl bg-kumo-base p-2 ring ring-kumo-line transition-colors hover:bg-kumo-tint/60"
        >
          <img
            src={item.event.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-12 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-kumo-strong">{item.event.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-kumo-subtle">
              {item.event.genre} · {item.event.city} · từ{' '}
              <span className="type-figure text-kumo-default">{formatPriceShort(item.minPrice)}</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              {onAskSingle && (
                <button
                  type="button"
                  onClick={() => onAskSingle(`Tóm tắt ${item.event.title}`)}
                  className="text-[11px] font-medium text-violet-ink underline underline-offset-2"
                >
                  Xem tóm tắt
                </button>
              )}
              <Link to={`/events/${item.event.id}/tickets`} className="text-[11px] font-medium text-kumo-strong underline underline-offset-2">
                Chọn ghế
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

export const TrendingListCard: React.FC<{ events: EnrichedEvent[] }> = ({ events }) => (
  <ol className="mt-2.5 space-y-2">
    {events.slice(0, 4).map((item, idx) => {
      const occPct = Math.round(item.occupancyRate * 100);
      return (
        <li key={item.event.id} className="rounded-xl bg-kumo-base p-2.5 ring ring-kumo-line">
          <div className="flex items-start gap-2.5">
            <span
              className={`type-figure grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                idx === 0 ? 'bg-coral text-coral-ink' : 'bg-kumo-recessed text-kumo-strong'
              }`}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/events/${item.event.id}`}
                  className="line-clamp-1 text-xs font-semibold text-kumo-strong hover:underline"
                >
                  {item.event.title}
                </Link>
                {idx === 0 && <Flame className="size-3.5 shrink-0 text-coral" />}
              </div>
              <p className="mt-0.5 text-[11px] text-kumo-subtle">
                {item.event.genre} · {item.event.city} · {item.zones.length} khu · từ{' '}
                <span className="type-figure text-kumo-default">{formatPrice(item.minPrice)}</span>
              </p>

              {/* Live Demand Progress Bar */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-kumo-recessed">
                  <div
                    className="h-full rounded-full bg-violet"
                    style={{ width: `${Math.max(8, Math.min(100, occPct > 0 ? occPct : Math.round(item.trendingScore)))}%` }}
                  />
                </div>
                <span className="type-figure text-[10px] text-kumo-subtle">
                  {occPct > 0 ? `${occPct}% giữ/bán` : `${item.availableSeats} chỗ trống`}
                </span>
              </div>
            </div>
          </div>
        </li>
      );
    })}
  </ol>
);

export const RecommendationListCard: React.FC<{ items: RecommendedEvent[] }> = ({ items }) => (
  <ul className="mt-2.5 space-y-2">
    {items.map(({ enriched, score, reasons }) => (
      <li key={enriched.event.id} className="rounded-xl bg-kumo-base p-2.5 ring ring-kumo-line">
        <div className="flex items-start gap-2.5">
          <img
            src={enriched.event.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-12 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-kumo-strong">{enriched.event.title}</p>
              <span className="type-figure shrink-0 rounded-full bg-kumo-success-tint px-2 py-0.5 text-[10px] text-kumo-success">
                {score}% hợp
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-kumo-subtle">
              {reasons.join(' · ')}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="type-figure text-xs text-kumo-strong">
                từ {formatPrice(enriched.minPrice)}
              </span>
              <Link
                to={`/events/${enriched.event.id}/tickets`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-ink hover:underline"
              >
                Chọn ghế
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </li>
    ))}
  </ul>
);

interface PreferencePickerCardProps {
  genres: string[];
  cities: string[];
  onSubmit: (prefs: UserPreferences) => void;
}

const BUDGET_OPTIONS: { label: string; maxBudget?: number; minBudget?: number }[] = [
  { label: 'Mọi mức' },
  { label: '≤ 1 triệu', maxBudget: 1_000_000 },
  { label: '≤ 1.5 triệu', maxBudget: 1_500_000 },
  { label: 'VIP (≥ 5 tr)', minBudget: 5_000_000 }
];

export const PreferencePickerCard: React.FC<PreferencePickerCardProps> = ({ genres, cities, onSubmit }) => {
  const [genre, setGenre] = useState<string | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [budgetIdx, setBudgetIdx] = useState<number>(0);
  const [seating, setSeating] = useState<ZoneKind | undefined>();

  const pill = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
      active
        ? 'bg-kumo-contrast text-kumo-inverse'
        : 'bg-kumo-recessed text-kumo-default hover:bg-kumo-tint'
    }`;

  const handleApply = () => {
    const budget = BUDGET_OPTIONS[budgetIdx];
    onSubmit({
      genre,
      city,
      maxBudget: budget.maxBudget,
      minBudget: budget.minBudget,
      seating
    });
  };

  return (
    <div className="mt-2.5 space-y-2.5 rounded-2xl bg-kumo-base p-3 ring ring-kumo-line">
      <div>
        <p className="mb-1 text-[11px] font-medium text-kumo-subtle">Thể loại</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setGenre(undefined)} className={pill(!genre)}>
            Tất cả
          </button>
          {genres.map(g => (
            <button key={g} type="button" onClick={() => setGenre(g)} className={pill(genre === g)}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-kumo-subtle">Thành phố</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCity(undefined)} className={pill(!city)}>
            Mọi nơi
          </button>
          {cities.map(c => (
            <button key={c} type="button" onClick={() => setCity(c)} className={pill(city === c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-kumo-subtle">Ngân sách</p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_OPTIONS.map((b, i) => (
            <button key={b.label} type="button" onClick={() => setBudgetIdx(i)} className={pill(budgetIdx === i)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-kumo-subtle">Kiểu chỗ ngồi</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setSeating(undefined)} className={pill(!seating)}>
            Linh hoạt
          </button>
          <button type="button" onClick={() => setSeating('seated')} className={pill(seating === 'seated')}>
            Ghế ngồi
          </button>
          <button type="button" onClick={() => setSeating('standing')} className={pill(seating === 'standing')}>
            Khu đứng
          </button>
        </div>
      </div>

      <button type="button" onClick={handleApply} className="btn btn-primary btn-sm h-9 w-full text-xs">
        <Sparkles className="size-3.5" />
        Gợi ý sự kiện phù hợp
      </button>
    </div>
  );
};
