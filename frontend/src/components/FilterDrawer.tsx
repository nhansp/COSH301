import React, { useState } from 'react';
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

  if (!isFilterOpen) return null;

  return (
    <div className="w-full lg:w-80 flex-shrink-0">
      <div className="rounded-2xl bg-[#1d0e32]/95 border border-purple-800/60 p-5 shadow-2xl backdrop-blur-md sticky top-28">
        {/* Header matching Picture.webp */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-900/60">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <SlidersHorizontal className="w-4 h-4 text-purple-400" />
            <span>Filter</span>
          </div>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="p-1 rounded-lg text-purple-300 hover:text-white hover:bg-purple-900/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5 pt-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              Start Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={filterState.startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#140a24] border border-purple-900/70 text-xs sm:text-sm text-purple-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              End Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={filterState.endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#140a24] border border-purple-900/70 text-xs sm:text-sm text-purple-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Genre Section matching Picture.webp */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-purple-300/80">Genre</label>
              {filterState.selectedGenres.length > 0 && (
                <button
                  onClick={clearGenres}
                  className="text-[11px] text-pink-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Search Genre Input */}
            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400/60">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                placeholder="Search Genre"
                value={genreSearch}
                onChange={e => setGenreSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#140a24] border border-purple-900/70 text-xs text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Selected genre tags matching Bollywood x, Hip Hop x */}
            <div className="flex flex-wrap gap-2 mb-3">
              {filterState.selectedGenres.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#12091c] text-xs font-semibold shadow-sm hover:bg-purple-100 transition-colors"
                >
                  <span>{g}</span>
                  <X className="w-3 h-3 text-[#12091c]" />
                </button>
              ))}
            </div>

            {/* Available genre chips */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-purple-900/40">
              {filteredGenres.map(g => {
                const isSelected = filterState.selectedGenres.includes(g);
                if (isSelected) return null;
                return (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className="px-2.5 py-1 rounded-full text-xs bg-purple-950/70 text-purple-300 border border-purple-800/40 hover:border-purple-500 hover:text-white transition-all flex items-center gap-1"
                  >
                    <span>+</span> {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-2 border-t border-purple-900/50">
            <button
              onClick={resetFilters}
              className="flex-1 py-2 rounded-xl bg-purple-950/60 text-purple-300 hover:bg-purple-900/50 text-xs font-medium border border-purple-800/40 transition-colors"
            >
              Reset Filters
            </button>
            <button
              onClick={() => setIsFilterOpen(false)}
              className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
