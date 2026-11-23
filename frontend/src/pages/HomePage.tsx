import React, { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronDown, MapPin, RefreshCw, Search, X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { Reveal } from '../components/ui/Reveal';
import { EmptyState } from '../components/ui/EmptyState';
import { Carousel } from '../components/ui/Carousel';
import { EventFeatureCard, EventTile, EventTileSkeleton } from '../components/events/EventCard';
import { useEvents } from '../context/EventContext';
import { useFeatures } from '../context/FeatureContext';
import { EventItem } from '../types';

const ALL_CITIES = 'All Cities';

/** Upcoming shows first (soonest first), then past ones (latest first). */
function byRelevance(events: EventItem[]): EventItem[] {
  const now = Date.now();
  const time = (e: EventItem) => Date.parse(e.rawDate);
  const upcoming = events.filter(e => time(e) >= now).sort((a, b) => time(a) - time(b));
  const past = events.filter(e => time(e) < now).sort((a, b) => time(b) - time(a));
  return [...upcoming, ...past];
}

/** Calendar months that have at least one show, for the date filter. */
function monthsOf(events: EventItem[]): { key: string; label: string }[] {
  const keys = Array.from(new Set(events.map(e => e.rawDate.slice(0, 7)))).sort();
  return keys.map(key => ({ key, label: `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}` }));
}

function monthRange(key: string): [string, string] {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${key}-01`, `${key}-${String(last).padStart(2, '0')}T23:59:59`];
}

const SegmentSelect: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ icon, label, value, onChange, children }) => (
  <label className="group/seg relative flex min-w-0 cursor-pointer items-center gap-3 px-5 py-3 transition-colors focus-within:bg-white/[0.06] hover:bg-white/[0.04]">
    <span className="text-kumo-subtle transition-colors group-focus-within/seg:text-violet">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs text-kumo-subtle">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="-ml-0.5 w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-base font-medium text-kumo-strong focus:outline-none"
      >
        {children}
      </select>
    </span>
    <ChevronDown className="pointer-events-none absolute right-4 size-4 text-kumo-subtle" />
  </label>
);

const SectionHeading: React.FC<{ id: string; title: string; note?: string; action?: React.ReactNode }> = ({ id, title, note, action }) => (
  <div className="flex items-end justify-between gap-6">
    <div className="min-w-0">
      <h2 id={id} className="type-display text-2xl sm:text-3xl">
        {title}
      </h2>
      {note && <p className="mt-1.5 text-kumo-subtle">{note}</p>}
    </div>
    {action}
  </div>
);

/** A shortcut into the schedule: a genre or a city, with a photo from one of its shows. */
const ExploreTile: React.FC<{ kind: string; name: string; count: number; image?: string; onSelect: () => void }> = ({
  kind,
  name,
  count,
  image,
  onSelect
}) => (
  <button
    type="button"
    onClick={onSelect}
    className="group relative isolate flex h-32 w-full flex-col justify-end overflow-hidden bg-midnight p-4 text-left text-white transition-transform duration-300 hover:-translate-y-0.5"
  >
    {image && (
      <span className="zoom-frame absolute inset-0 -z-10">
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover opacity-60" />
      </span>
    )}
    <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-midnight/90 to-midnight/10" />
    <span className="text-xs text-white/75">{kind}</span>
    <span className="type-display text-xl text-white">{name}</span>
    <span className="mt-0.5 text-sm text-white/75">{count} đêm diễn</span>
  </button>
);

export const HomePage: React.FC = () => {
  const {
    events,
    filteredEvents,
    isLoading,
    loadError,
    refreshEvents,
    filterState,
    setSearchQuery,
    setStartDate,
    setEndDate,
    toggleGenre,
    clearGenres,
    setCity,
    resetFilters
  } = useEvents();
  const { isEnabled } = useFeatures();
  const discoverRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => byRelevance(events), [events]);
  const featured = ordered.slice(0, 5);
  const byDate = useMemo(() => [...events].sort((a, b) => Date.parse(a.rawDate) - Date.parse(b.rawDate)), [events]);
  const genres = useMemo(() => Array.from(new Set(events.map(e => e.genre))).sort(), [events]);
  const cities = useMemo(() => Array.from(new Set(events.map(e => e.city))).sort(), [events]);
  const months = useMemo(() => monthsOf(events), [events]);
  const results = useMemo(() => byRelevance(filteredEvents), [filteredEvents]);

  const monthKey = filterState.startDate ? filterState.startDate.slice(0, 7) : '';
  const filtering =
    filterState.searchQuery.trim() !== '' || filterState.selectedGenres.length > 0 || filterState.city !== ALL_CITIES || monthKey !== '';
  const ticketsUrl = (event: EventItem) => (isEnabled('seat_map_realtime') ? `/events/${event.id}/tickets` : `/checkout/${event.id}`);

  const showResults = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    discoverRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const chooseMonth = (key: string) => {
    if (!key) {
      setStartDate('');
      setEndDate('');
      return;
    }
    const [start, end] = monthRange(key);
    setStartDate(start);
    setEndDate(end);
  };

  const onlyGenre = (genre: string) => {
    clearGenres();
    toggleGenre(genre);
    showResults();
  };

  const firstImage = (match: (e: EventItem) => boolean) => ordered.find(match)?.imageUrl;

  const activeFilters = [
    ...(filterState.searchQuery.trim() ? [{ key: 'q', label: `“${filterState.searchQuery.trim()}”`, clear: () => setSearchQuery('') }] : []),
    ...(filterState.city !== ALL_CITIES ? [{ key: 'city', label: filterState.city, clear: () => setCity(ALL_CITIES) }] : []),
    ...(monthKey ? [{ key: 'month', label: months.find(m => m.key === monthKey)?.label ?? monthKey, clear: () => chooseMonth('') }] : []),
    ...filterState.selectedGenres.map(g => ({ key: `g-${g}`, label: g, clear: () => toggleGenre(g) }))
  ];

  return (
    <PageShell>
      <Navbar />

      <main className="flex-1">
        {/* Search first: the stage is dark, lit from the corners like a hall before the show. */}
        <section data-mode="dark" aria-labelledby="search-title" className="relative isolate overflow-hidden border-b border-kumo-hairline bg-midnight text-kumo-default">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_88%_0%,rgb(155_123_255/0.28),transparent_70%),radial-gradient(40%_70%_at_0%_100%,rgb(255_141_115/0.14),transparent_70%)]"
          />
          <div className="page-enter mx-auto max-w-page px-4 pt-8 pb-8 sm:px-6 lg:px-10 lg:pt-10 lg:pb-10">
            <h1 id="search-title" className="type-display max-w-3xl text-display-sm">
              Tìm concert tiếp theo của bạn
            </h1>
            <p className="mt-2 text-kumo-subtle">
              {isLoading || loadError
                ? 'Tìm theo nghệ sĩ, thành phố và thời gian.'
                : `${events.length} đêm diễn ở ${cities.length} thành phố. Chọn chỗ ngồi trên sơ đồ sân khấu.`}
            </p>

            <form
              role="search"
              onSubmit={e => {
                e.preventDefault();
                showResults();
              }}
              className="mt-6 grid overflow-hidden rounded-3xl bg-plum ring ring-kumo-line transition-shadow duration-300 focus-within:shadow-[0_0_0_6px_rgb(155_123_255/0.15)] focus-within:ring-2 focus-within:ring-violet lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:rounded-full"
            >
              <label className="group/seg relative flex min-w-0 items-center gap-3 px-5 py-3 transition-colors focus-within:bg-white/[0.06] lg:pl-7">
                <Search className="size-5 shrink-0 text-kumo-subtle transition-colors group-focus-within/seg:text-violet" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-kumo-subtle">Nghệ sĩ, đêm diễn hoặc địa điểm</span>
                  <input
                    type="search"
                    value={filterState.searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Ví dụ: Mỹ Tâm, Mỹ Đình"
                    aria-label="Tìm nghệ sĩ, đêm diễn hoặc địa điểm"
                    className="w-full bg-transparent text-base font-medium text-kumo-strong placeholder:font-normal placeholder:text-kumo-placeholder focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                  />
                </span>
                {filterState.searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Xoá từ khoá" className="btn-icon size-9">
                    <X className="size-4" />
                  </button>
                )}
              </label>
              <div className="grid grid-cols-2 border-t border-kumo-line lg:contents">
                <div className="border-r border-kumo-line lg:border-l">
                  <SegmentSelect icon={<MapPin className="size-5" />} label="Thành phố" value={filterState.city} onChange={setCity}>
                    <option value={ALL_CITIES}>Mọi nơi</option>
                    {cities.map(city => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </SegmentSelect>
                </div>
                <div className="lg:border-l lg:border-kumo-line">
                  <SegmentSelect icon={<CalendarDays className="size-5" />} label="Thời gian" value={monthKey} onChange={chooseMonth}>
                    <option value="">Mọi lúc</option>
                    {months.map(m => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </SegmentSelect>
                </div>
              </div>
              <div className="border-t border-kumo-line p-2 lg:border-t-0 lg:pl-0">
                <button type="submit" className="btn btn-lg h-full min-h-12 w-full bg-violet px-8 text-midnight hover:bg-[#ab8fff]">
                  <Search className="size-4" />
                  Tìm
                </button>
              </div>
            </form>
          </div>
        </section>

        <div ref={discoverRef} className="scroll-mt-16">
          {isLoading ? (
            <section aria-busy="true" className="mx-auto grid max-w-page gap-5 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:px-10">
              <div className="skeleton min-h-[26rem] rounded-none lg:col-span-7" />
              <div className="grid grid-cols-2 gap-5 lg:col-span-5">
                {Array.from({ length: 4 }, (_, i) => (
                  <EventTileSkeleton key={i} />
                ))}
              </div>
            </section>
          ) : loadError ? (
            <div className="mx-auto max-w-page px-4 py-12 sm:px-6 lg:px-10">
              <EmptyState
                role="alert"
                title="Chưa tải được lịch diễn"
                body="Kiểm tra kết nối mạng rồi tải lại."
                action={
                  <button type="button" onClick={() => refreshEvents()} className="btn btn-ink">
                    <RefreshCw className="size-4" />
                    Tải lại
                  </button>
                }
              />
            </div>
          ) : filtering ? (
            <section aria-labelledby="results-title" className="mx-auto max-w-page px-4 py-12 sm:px-6 lg:px-10">
              <SectionHeading
                id="results-title"
                title={results.length > 0 ? `${results.length} đêm diễn phù hợp` : 'Không có đêm diễn phù hợp'}
                action={
                  <button type="button" onClick={resetFilters} className="btn btn-quiet btn-sm shrink-0">
                    Xoá bộ lọc
                  </button>
                }
              />
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Bộ lọc đang dùng">
                {activeFilters.map(f => (
                  <li key={f.key}>
                    <button type="button" onClick={f.clear} aria-label={`Bỏ lọc ${f.label}`} className="chip h-9 pr-2.5">
                      {f.label}
                      <X className="size-3.5 text-kumo-subtle" />
                    </button>
                  </li>
                ))}
              </ul>
              {results.length === 0 ? (
                <EmptyState
                  className="mt-8"
                  title="Thử nới bộ lọc"
                  body="Dùng từ khoá ngắn hơn, hoặc chọn Mọi nơi và Mọi lúc."
                  action={
                    <button type="button" onClick={resetFilters} className="btn btn-secondary">
                      Xem toàn bộ lịch diễn
                    </button>
                  }
                />
              ) : (
                <ul className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                  {results.map(event => (
                    <li key={event.id}>
                      <EventTile event={event} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              {featured.length > 0 && (
                <section aria-labelledby="featured-title" className="mx-auto max-w-page px-4 pt-8 pb-16 sm:px-6 lg:px-10">
                  <SectionHeading
                    id="featured-title"
                    title="Nổi bật"
                    note="Đêm diễn sắp tới và vừa diễn ra gần đây."
                    action={
                      <a href="#schedule" className="link hidden shrink-0 sm:inline">
                        Xem lịch diễn
                      </a>
                    }
                  />
                  <div className="mt-5 grid gap-5 lg:grid-cols-12">
                    <EventFeatureCard event={featured[0]} ticketsUrl={ticketsUrl(featured[0])} className="lg:col-span-7" />
                    {featured.length > 1 && (
                      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:col-span-5">
                        {featured.slice(1).map((event, i) => (
                          <Reveal as="li" key={event.id} delay={i * 70} className="w-[72%] shrink-0 snap-start sm:w-auto">
                            <EventTile event={event} compact />
                          </Reveal>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              )}

              <section aria-labelledby="explore-title" className="border-y border-kumo-hairline bg-kumo-elevated">
                <div className="mx-auto max-w-page px-4 py-12 sm:px-6 lg:px-10">
                  <SectionHeading id="explore-title" title="Khám phá nhanh" note="Theo thể loại nhạc và thành phố tổ chức." />
                  <ul className="no-scrollbar -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
                    {genres.map(genre => (
                      <li key={genre} className="w-[44%] shrink-0 sm:w-auto">
                        <ExploreTile
                          kind="Thể loại"
                          name={genre}
                          count={events.filter(e => e.genre === genre).length}
                          image={firstImage(e => e.genre === genre)}
                          onSelect={() => onlyGenre(genre)}
                        />
                      </li>
                    ))}
                    {cities.map(city => (
                      <li key={city} className="w-[44%] shrink-0 sm:w-auto">
                        <ExploreTile
                          kind="Thành phố"
                          name={city}
                          count={events.filter(e => e.city === city).length}
                          image={firstImage(e => e.city === city)}
                          onSelect={() => {
                            setCity(city);
                            showResults();
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section id="schedule" aria-labelledby="schedule-title" className="mx-auto max-w-page scroll-mt-20 px-4 py-16 sm:px-6 lg:px-10">
                <Carousel
                  label="Lịch diễn theo ngày"
                  header={<SectionHeading id="schedule-title" title="Lịch diễn" note={`Toàn bộ ${events.length} đêm diễn, xếp theo ngày diễn.`} />}
                >
                  {byDate.map(event => (
                    <EventTile key={event.id} event={event} />
                  ))}
                </Carousel>
              </section>

              {isEnabled('seat_map_realtime') && featured[0] && (
                <section data-mode="dark" aria-labelledby="seat-map-band" className="bg-midnight text-kumo-default">
                  <Reveal className="mx-auto grid max-w-page items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-10">
                    <div>
                      <h2 id="seat-map-band" className="type-display text-2xl sm:text-3xl">
                        Chọn đúng chiếc ghế bạn muốn
                      </h2>
                      <p className="mt-3 max-w-2xl text-kumo-subtle">
                        Mỗi đêm diễn có sơ đồ sân khấu 3D và 2D. Bấm vào ghế để giữ chỗ trong 5 phút, rồi xem thử sân khấu từ chính chỗ ngồi đó.
                      </p>
                    </div>
                    <Link to={ticketsUrl(featured[0])} className="btn btn-primary btn-lg justify-self-start">
                      Mở sơ đồ chọn vé
                    </Link>
                  </Reveal>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </PageShell>
  );
};
