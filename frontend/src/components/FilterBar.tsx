import React from 'react';
import { Search, SlidersHorizontal, Star, Flame, X } from 'lucide-react';
import { useEvents } from '../context/EventContext';

export const FilterBar: React.FC = () => {
  const {
    filterState,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    activeViewTab,
    setActiveViewTab,
    resetFilters
  } = useEvents();

  const activeFiltersCount =
    (filterState.startDate ? 1 : 0) +
    (filterState.endDate ? 1 : 0) +
    filterState.selectedGenres.length +
    (filterState.city !== 'All Cities' ? 1 : 0);

  const pill = (active: boolean) =>
    `h-11 md:h-8 px-3 rounded-full text-sm font-medium flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap transition-all ${
      active
        ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 font-semibold shadow-xs'
        : 'bg-kumo-base ring-1 ring-emerald-500/20 text-kumo-default hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300'
    }`;

  return (
    <div className="w-full pt-2 pb-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
          <input
            type="search"
            value={filterState.searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm nghệ sĩ, sự kiện, địa điểm biểu diễn..."
            aria-label="Tìm kiếm sự kiện"
            className="w-full h-11 sm:h-9 pl-9 pr-10 rounded-xl bg-kumo-control ring-1 ring-emerald-500/25 text-base text-kumo-default placeholder:text-kumo-placeholder focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all [&::-webkit-search-cancel-button]:hidden shadow-2xs"
          />
          {filterState.searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Xóa tìm kiếm"
              className="absolute right-1 top-1/2 -translate-y-1/2 grid size-8 sm:size-6 place-items-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto no-scrollbar md:overflow-visible md:flex-wrap">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            aria-expanded={isFilterOpen}
            className={pill(isFilterOpen)}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Bộ lọc nâng cao</span>
            {activeFiltersCount > 0 && (
              <span className="min-w-4.5 h-4.5 px-1.5 grid place-items-center rounded-full bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100 text-xs font-bold tabular-nums">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveViewTab(activeViewTab === 'popular' ? 'all' : 'popular')}
            aria-pressed={activeViewTab === 'popular'}
            className={pill(activeViewTab === 'popular')}
          >
            <Star className="size-3.5" />
            <span>Sự kiện hot</span>
          </button>

          <button
            onClick={() => setActiveViewTab(activeViewTab === 'trending' ? 'all' : 'trending')}
            aria-pressed={activeViewTab === 'trending'}
            className={pill(activeViewTab === 'trending')}
          >
            <Flame className="size-3.5" />
            <span>Trending Venues</span>
          </button>

          {(activeFiltersCount > 0 || activeViewTab !== 'all') && (
            <button
              onClick={resetFilters}
              className="h-11 md:h-8 px-2.5 flex-shrink-0 rounded-lg text-sm text-kumo-subtle hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium"
            >
              Đặt lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
