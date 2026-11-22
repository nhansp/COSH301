import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search, X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ImageCredit } from '../components/ImageCredit';
import { useEvents } from '../context/EventContext';
import { useFeatures } from '../context/FeatureContext';
import { accentStyle, useEventAccent } from '../hooks/useEventAccent';
import { formatPriceShort } from '../services/eventService';
import { EventItem } from '../types';

const ALL_CITIES = 'All Cities';

function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('vi-VN', { day: '2-digit' }),
    month: `Th${d.getMonth() + 1}`,
    year: d.getFullYear(),
    weekday: d.toLocaleDateString('vi-VN', { weekday: 'long' }),
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  };
}

/** The next show from today, or the latest one when every date has passed. */
function pickHeadliner(events: EventItem[]): EventItem | undefined {
  const now = Date.now();
  const sorted = [...events].sort((a, b) => Date.parse(a.rawDate) - Date.parse(b.rawDate));
  return sorted.find(e => Date.parse(e.rawDate) >= now) ?? sorted[sorted.length - 1];
}

const Hero: React.FC<{ event: EventItem }> = ({ event }) => {
  const accent = useEventAccent(event.imageUrl);
  const { isEnabled } = useFeatures();
  const when = dateParts(event.rawDate);
  return (
    <section style={accentStyle(accent)} aria-label="Sự kiện nổi bật" className="relative isolate overflow-hidden bg-black">
      <img
        src={event.bannerUrl || event.imageUrl}
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover object-[center_30%] motion-safe:animate-[house-up_1400ms_var(--ease-encore)_both]"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
      <div className="mx-auto flex min-h-[78svh] max-w-6xl flex-col justify-end px-4 pt-24 pb-10 sm:px-6 lg:min-h-[72svh] lg:px-10 lg:pb-14">
        <div className="max-w-4xl text-white">
          <p className="mb-3 flex flex-wrap items-center gap-x-3 text-base text-white/85">
            <span className="inline-block h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
            <span className="capitalize">
              {when.weekday}, {when.day}/{event.rawDate.slice(5, 7)}/{when.year}
            </span>
            <span>{event.venue}</span>
          </p>
          <h1 className="font-display text-4xl leading-[1.06] font-bold text-balance [font-stretch:120%] sm:text-display-md lg:text-display-lg">
            {event.title}
          </h1>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to={isEnabled('seat_map_realtime') ? `/events/${event.id}/tickets` : `/checkout/${event.id}`}
              className="inline-flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              Chọn vé
            </Link>
            <Link
              to={`/event/${event.id}`}
              className="inline-flex h-12 items-center rounded-lg px-5 font-medium text-white ring ring-white/35 transition-colors hover:bg-white/10"
            >
              Xem chi tiết
            </Link>
          </div>
        </div>
      </div>
      <ImageCredit credit={event.imageCredit} className="absolute right-4 bottom-2 max-w-[60%] truncate text-white/60 sm:right-6" />
    </section>
  );
};

const ScheduleRow: React.FC<{ event: EventItem }> = ({ event }) => {
  const when = dateParts(event.rawDate);
  return (
    <li>
      <Link
        to={`/event/${event.id}`}
        className="group grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-4 py-5 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_5.5rem] sm:gap-6"
      >
        <span className="flex flex-col leading-none">
          <span className="font-display text-4xl font-bold tabular-nums text-kumo-strong [font-stretch:68%] sm:text-5xl">
            {when.day}
          </span>
          <span className="mt-1 text-sm text-kumo-subtle">
            {when.month} {when.year}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg leading-snug font-semibold text-kumo-strong underline-offset-4 [font-stretch:105%] group-hover:underline sm:text-xl">
            {event.title}
          </span>
          <span className="mt-1 block text-sm text-kumo-subtle">
            {when.time} · {event.venue}, {event.city}
          </span>
          <span className="mt-1 block text-sm text-kumo-subtle">{event.genre}</span>
        </span>
        <span className="text-right">
          <span className="block text-xs text-kumo-subtle">từ</span>
          <span className="font-display text-lg font-semibold tabular-nums text-kumo-strong [font-stretch:75%]">
            {event.priceStart > 0 ? formatPriceShort(event.priceStart) : '—'}
          </span>
        </span>
        <img
          src={event.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="hidden aspect-square w-full object-cover sm:block"
        />
      </Link>
    </li>
  );
};

export const HomePage: React.FC = () => {
  const {
    events,
    filteredEvents,
    isLoading,
    loadError,
    refreshEvents,
    filterState,
    setSearchQuery,
    toggleGenre,
    clearGenres,
    setCity,
    resetFilters
  } = useEvents();

  const headliner = useMemo(() => pickHeadliner(events), [events]);
  const genres = useMemo(() => Array.from(new Set(events.map(e => e.genre))).sort(), [events]);
  const cities = useMemo(() => Array.from(new Set(events.map(e => e.city))).sort(), [events]);
  const schedule = useMemo(
    () => [...filteredEvents].sort((a, b) => Date.parse(a.rawDate) - Date.parse(b.rawDate)),
    [filteredEvents]
  );
  const filtering =
    filterState.searchQuery !== '' || filterState.selectedGenres.length > 0 || filterState.city !== ALL_CITIES;

  const chip = (active: boolean) =>
    `h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
      active ? 'bg-kumo-contrast text-kumo-inverse' : 'bg-kumo-base text-kumo-default ring ring-kumo-line hover:bg-kumo-tint'
    }`;

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      {headliner && <Hero event={headliner} />}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-bold text-kumo-strong [font-stretch:118%] sm:text-display-sm">Lịch diễn</h2>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-kumo-subtle" />
            <input
              type="search"
              value={filterState.searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm nghệ sĩ, đêm diễn, địa điểm"
              aria-label="Tìm đêm diễn"
              className="h-11 w-full rounded-lg bg-kumo-control pr-10 pl-9 text-base text-kumo-default ring ring-kumo-line placeholder:text-kumo-placeholder focus:ring-2 focus:ring-kumo-contrast focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {filterState.searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xoá từ khoá"
                className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-kumo-subtle hover:bg-kumo-tint"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Lọc theo thể loại và thành phố">
          <button type="button" aria-pressed={filterState.selectedGenres.length === 0} onClick={clearGenres} className={chip(filterState.selectedGenres.length === 0)}>
            Mọi thể loại
          </button>
          {genres.map(genre => (
            <button
              key={genre}
              type="button"
              aria-pressed={filterState.selectedGenres.includes(genre)}
              onClick={() => toggleGenre(genre)}
              className={chip(filterState.selectedGenres.includes(genre))}
            >
              {genre}
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-kumo-hairline" />
          {cities.map(city => (
            <button
              key={city}
              type="button"
              aria-pressed={filterState.city === city}
              onClick={() => setCity(filterState.city === city ? ALL_CITIES : city)}
              className={chip(filterState.city === city)}
            >
              {city}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="py-16 text-kumo-subtle">Đang tải lịch diễn…</p>
        ) : loadError ? (
          <div role="alert" className="py-12">
            <p className="text-lg text-kumo-default">Chưa tải được lịch diễn. Kiểm tra kết nối mạng rồi thử lại.</p>
            <button
              type="button"
              onClick={() => refreshEvents()}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-kumo-contrast px-4 font-medium text-kumo-inverse"
            >
              <RefreshCw className="size-4" />
              Tải lại
            </button>
          </div>
        ) : schedule.length === 0 ? (
          <div className="py-12">
            <p className="text-lg text-kumo-default">Không có đêm diễn nào khớp với bộ lọc.</p>
            {filtering && (
              <button type="button" onClick={resetFilters} className="mt-3 text-kumo-link underline underline-offset-4">
                Xoá bộ lọc
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-kumo-hairline border-y border-kumo-hairline">
            {schedule.map(event => (
              <ScheduleRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
};
