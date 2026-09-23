import React from 'react';
import { Navbar } from '../components/Navbar';
import { FilterBar } from '../components/FilterBar';
import { FilterDrawer } from '../components/FilterDrawer';
import { EventList } from '../components/EventList';
import { Footer } from '../components/Footer';
import { useEvents } from '../context/EventContext';

export const HomePage: React.FC = () => {
  const { filteredEvents, isLoading, isFilterOpen, filterState } = useEvents();

  return (
    <div className="min-h-screen purple-glow-bg flex flex-col selection:bg-purple-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Secondary Filter & Search Bar matching Picture.webp */}
        <FilterBar />

        {/* Dynamic Section Header & Results count */}
        <div className="mt-4 mb-6 flex items-center justify-between text-xs sm:text-sm text-purple-300/80 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="font-semibold text-white">
              {filterState.city === 'All Cities' ? 'Tất cả địa điểm' : filterState.city}
            </span>
            <span>•</span>
            <span>{filteredEvents.length} concert &amp; sự kiện đang mở bán vé</span>
          </div>

          {filterState.selectedGenres.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-purple-300">
              <span>Đang lọc:</span>
              <span className="text-white font-medium">
                {filterState.selectedGenres.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Layout: Events Grid with Side Filter Drawer when opened */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Main Events Grid */}
          <div className="flex-1 w-full">
            <EventList events={filteredEvents} isLoading={isLoading} />
          </div>

          {/* Right Floating / Docked Filter Drawer matching Picture.webp */}
          {isFilterOpen && <FilterDrawer />}
        </div>
      </main>

      {/* Footer focused on concert ticket buyers */}
      <Footer />
    </div>
  );
};
