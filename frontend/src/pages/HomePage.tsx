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
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Secondary Filter & Search Bar matching Picture.webp */}
        <FilterBar />

        <div className="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-kumo-strong">
            {filterState.city === 'All Cities' ? 'Tất cả địa điểm' : filterState.city}
            <span className="block sm:inline sm:ml-2 mt-0.5 sm:mt-0 text-base font-normal text-kumo-subtle tabular-nums">
              {filteredEvents.length} sự kiện đang mở bán
            </span>
          </h1>

          {filterState.selectedGenres.length > 0 && (
            <p className="hidden sm:block text-sm text-kumo-subtle">
              Đang lọc:{' '}
              <span className="text-kumo-default font-medium">
                {filterState.selectedGenres.join(', ')}
              </span>
            </p>
          )}
        </div>

        {/* Layout: Events Grid with Side Filter Drawer when opened */}
        <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
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
