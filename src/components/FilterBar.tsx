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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar matching Picture.webp */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-purple-400/70" />
          </div>
          <input
            type="text"
            value={filterState.searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full pl-10 pr-10 py-2.5 rounded-full bg-[#1b0d2d]/90 border border-purple-900/60 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
          />
          {filterState.searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-purple-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Pills & Filter Toggle matching Picture.webp */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          {/* Filter toggle button */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-4 py-2 rounded-full border text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer ${
              isFilterOpen || activeFiltersCount > 0
                ? 'bg-purple-900/60 border-purple-500 text-white shadow-lg shadow-purple-950'
                : 'bg-[#1b0d2d] border-purple-900/70 text-purple-200 hover:bg-purple-900/30'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Popular Events Pill */}
          <button
            onClick={() => {
              if (activeViewTab === 'popular') {
                setActiveViewTab('all');
              } else {
                setActiveViewTab('popular');
              }
            }}
            className={`px-4 py-2 rounded-full border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewTab === 'popular'
                ? 'bg-white text-[#12091c] border-white shadow-md'
                : 'bg-[#1b0d2d] border-purple-900/70 text-purple-200 hover:bg-purple-900/30'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                activeViewTab === 'popular' ? 'text-purple-600 fill-purple-600' : 'text-purple-400'
              }`}
            />
            <span>Popular Events</span>
          </button>

          {/* Trending Venues Pill */}
          <button
            onClick={() => {
              if (activeViewTab === 'trending') {
                setActiveViewTab('all');
              } else {
                setActiveViewTab('trending');
              }
            }}
            className={`px-4 py-2 rounded-full border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewTab === 'trending'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-lg shadow-purple-900/50'
                : 'bg-[#1b0d2d] border-purple-900/70 text-purple-200 hover:bg-purple-900/30'
            }`}
          >
            <Flame
              className={`w-3.5 h-3.5 ${
                activeViewTab === 'trending' ? 'text-amber-300 fill-amber-300' : 'text-pink-400'
              }`}
            />
            <span>Trending Venues</span>
          </button>

          {/* Clear Filters if active */}
          {(activeFiltersCount > 0 || activeViewTab !== 'all') && (
            <button
              onClick={resetFilters}
              className="text-xs text-purple-400/80 hover:text-pink-400 underline underline-offset-4 ml-1 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
