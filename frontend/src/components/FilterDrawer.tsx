import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, X, Calendar, Search, Check } from 'lucide-react';
import { useEvents } from '../context/EventContext';

export const FilterDrawer: React.FC = () => {
  const {
    filterState,
    setStartDate,
    setEndDate,
    toggleGenre,
    clearGenres,
    resetFilters,
    isFilterOpen,
    setIsFilterOpen
  } = useEvents();

  const [genreSearch, setGenreSearch] = useState('');

  const allAvailableGenres = [
    'Bollywood',
    'Hip Hop',
    'Electronic',
    'Sufi',
    'Pop',
    'Rock',
    'Indie',
    'EDM',
    'Techno'
  ];

  const filteredGenres = allAvailableGenres.filter(g =>
    g.toLowerCase().includes(genreSearch.toLowerCase())
  );

  // Below lg the drawer is a modal sheet: lock page scroll and close on Escape.
  useEffect(() => {
    if (!isFilterOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilterOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const isSheet = window.matchMedia('(max-width: 1023px)').matches;
    const previousOverflow = document.body.style.overflow;
    if (isSheet) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFilterOpen, setIsFilterOpen]);

  if (!isFilterOpen) return null;

  const fieldLabel = 'block text-sm font-medium text-kumo-default mb-1.5';
  const field =
    'w-full h-11 lg:h-9 pl-9 pr-3 rounded-lg bg-kumo-control ring ring-kumo-line text-base text-kumo-default placeholder:text-kumo-placeholder focus:outline-none focus:ring-2 focus:ring-kumo-brand';

  return (
    <aside
      aria-label="Bộ lọc"
      onClick={() => setIsFilterOpen(false)}
      className="fixed inset-0 z-50 flex items-end bg-black/40 lg:static lg:z-auto lg:block lg:bg-transparent lg:w-72 lg:flex-shrink-0 lg:self-stretch"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="w-full max-h-[85dvh] flex flex-col rounded-t-2xl bg-kumo-raised ring ring-kumo-line shadow-xl lg:bg-kumo-base lg:max-h-none lg:rounded-xl lg:shadow-xs lg:sticky lg:top-20"
      >
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 lg:h-12 border-b border-kumo-hairline">
          <h2 className="flex items-center gap-2 text-base font-semibold text-kumo-strong">
            <SlidersHorizontal className="size-4 text-kumo-subtle" />
            Filter
          </h2>
          <button
            onClick={() => setIsFilterOpen(false)}
            aria-label="Đóng bộ lọc"
            className="grid size-11 lg:size-7 place-items-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5">
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 lg:grid-cols-1">
            <div>
              <label htmlFor="filter-start" className={fieldLabel}>Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-kumo-subtle pointer-events-none" />
                <input
                  id="filter-start"
                  type="date"
                  value={filterState.startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className={field}
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-end" className={fieldLabel}>End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-kumo-subtle pointer-events-none" />
                <input
                  id="filter-end"
                  type="date"
                  value={filterState.endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className={field}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="filter-genre" className="text-sm font-medium text-kumo-default">Genre</label>
              {filterState.selectedGenres.length > 0 && (
                <button
                  onClick={clearGenres}
                  className="text-sm text-kumo-link underline decoration-kumo-interact hover:decoration-current underline-offset-2"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-kumo-subtle pointer-events-none" />
              <input
                id="filter-genre"
                type="text"
                placeholder="Search Genre"
                value={genreSearch}
                onChange={e => setGenreSearch(e.target.value)}
                className={field}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {filterState.selectedGenres.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  aria-label={`Bỏ lọc ${g}`}
                  className="h-11 lg:h-7 inline-flex items-center gap-1 pl-3 pr-2 lg:pl-2.5 lg:pr-1.5 rounded-full bg-kumo-contrast text-kumo-inverse text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {g}
                  <X className="size-3.5" />
                </button>
              ))}
              {filteredGenres.map(g => {
                if (filterState.selectedGenres.includes(g)) return null;
                return (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className="h-11 lg:h-7 px-3 lg:px-2.5 rounded-full text-sm bg-kumo-base ring ring-kumo-line text-kumo-default hover:bg-kumo-tint transition-colors"
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-4 border-t border-kumo-hairline">
          <button
            onClick={resetFilters}
            className="flex-1 h-11 lg:h-9 rounded-lg bg-kumo-base ring ring-kumo-line hover:bg-kumo-tint text-kumo-default text-base font-medium transition-colors"
          >
            Reset Filters
          </button>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="flex-1 h-11 lg:h-9 rounded-lg bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand text-base font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Check className="size-4" />
            Apply
          </button>
        </div>
      </div>
    </aside>
  );
};
