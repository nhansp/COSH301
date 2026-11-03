import React, { useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { HeroSpotlight } from '../components/HeroSpotlight';
import { GenreBar } from '../components/GenreBar';
import { FilterBar } from '../components/FilterBar';
import { FilterDrawer } from '../components/FilterDrawer';
import { EventList } from '../components/EventList';
import { TrendingArtists } from '../components/TrendingArtists';
import { IconicVenues } from '../components/IconicVenues';
import { ConcertPerks } from '../components/ConcertPerks';
import { FanReviews } from '../components/FanReviews';
import { ConcertFAQ } from '../components/ConcertFAQ';
import { EarlyDropNewsletter } from '../components/EarlyDropNewsletter';
import { ScrollToTop } from '../components/ScrollToTop';
import { Footer } from '../components/Footer';
import { useEvents } from '../context/EventContext';
import { Sparkles, Calendar, Music } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { filteredEvents, isLoading, isFilterOpen, filterState } = useEvents();
  const eventsSectionRef = useRef<HTMLDivElement>(null);

  const handleScrollToEvents = () => {
    if (eventsSectionRef.current) {
      eventsSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-kumo-canvas text-kumo-default selection:bg-emerald-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        {/* Hero Spotlight Section */}
        <HeroSpotlight onExploreClick={handleScrollToEvents} />

        {/* Quick Genre Selector Strip */}
        <GenreBar />

        {/* Anchor for Smooth Scrolling to Events */}
        <div id="events-section" ref={eventsSectionRef} className="scroll-mt-20">
          {/* Secondary Filter & Search Bar */}
          <FilterBar />

          {/* Section Heading & Active Filters */}
          <div className="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-1">
                <Music className="size-3" />
                <span>Danh sách sự kiện</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-kumo-strong flex items-center gap-2">
                <span>
                  {filterState.city === 'All Cities'
                    ? 'Tất cả concert & đêm nhạc'
                    : `Sự kiện tại ${filterState.city}`}
                </span>
                <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {filteredEvents.length} show
                </span>
              </h2>
            </div>

            {filterState.selectedGenres.length > 0 && (
              <p className="text-sm text-kumo-subtle flex items-center gap-1.5">
                <span>Đang lọc thể loại:</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-medium">
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

            {/* Right Floating / Docked Filter Drawer */}
            {isFilterOpen && <FilterDrawer />}
          </div>
        </div>

        {/* =========================================================================
            SCROLL-REVEALED COMPONENTS:
            Rich immersive content discovered as the user scrolls down the page
           ========================================================================= */}

        {/* Scroll Component 1: Trending Headliners & Artists */}
        <TrendingArtists />

        {/* Scroll Component 2: Iconic Venues & Stadiums */}
        <IconicVenues />

        {/* Scroll Component 3: Concert-goer Benefits & Trust Pillars */}
        <ConcertPerks />

        {/* Scroll Component 4: Fan Community Testimonials & Social Proof */}
        <FanReviews />

        {/* Scroll Component 5: Interactive FAQ Accordion */}
        <ConcertFAQ />

        {/* Scroll Component 6: Early-Bird Newsletter CTA */}
        <EarlyDropNewsletter />
      </main>

      {/* Floating Scroll to Top button */}
      <ScrollToTop />

      {/* Footer */}
      <Footer />
    </div>
  );
};
