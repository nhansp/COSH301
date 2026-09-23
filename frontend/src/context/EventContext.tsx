import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { EventItem, FilterState } from '../types';
import { fetchEventsFromAPI } from '../services/eventService';

interface EventContextType {
  events: EventItem[];
  filteredEvents: EventItem[];
  isLoading: boolean;
  filterState: FilterState;
  setSearchQuery: (query: string) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  toggleGenre: (genre: string) => void;
  clearGenres: () => void;
  setCity: (city: string) => void;
  toggleTrending: () => void;
  togglePopular: () => void;
  resetFilters: () => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
  activeViewTab: 'all' | 'popular' | 'trending';
  setActiveViewTab: (tab: 'all' | 'popular' | 'trending') => void;
  refreshEvents: () => Promise<void>;
  getEventById: (id: string) => EventItem | undefined;
}

const initialFilterState: FilterState = {
  searchQuery: '',
  startDate: '',
  endDate: '',
  selectedGenres: [],
  city: 'All Cities',
  onlyTrending: false,
  onlyPopular: false,
  priceRange: [0, 5000000]
};

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [activeViewTab, setActiveViewTab] = useState<'all' | 'popular' | 'trending'>('all');

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const data = await fetchEventsFromAPI();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const setSearchQuery = (query: string) => {
    setFilterState(prev => ({ ...prev, searchQuery: query }));
  };

  const setStartDate = (date: string) => {
    setFilterState(prev => ({ ...prev, startDate: date }));
  };

  const setEndDate = (date: string) => {
    setFilterState(prev => ({ ...prev, endDate: date }));
  };

  const toggleGenre = (genre: string) => {
    setFilterState(prev => {
      const exists = prev.selectedGenres.includes(genre);
      const updated = exists
        ? prev.selectedGenres.filter(g => g !== genre)
        : [...prev.selectedGenres, genre];
      return { ...prev, selectedGenres: updated };
    });
  };

  const clearGenres = () => {
    setFilterState(prev => ({ ...prev, selectedGenres: [] }));
  };

  const setCity = (city: string) => {
    setFilterState(prev => ({ ...prev, city }));
  };

  const toggleTrending = () => {
    setFilterState(prev => ({ ...prev, onlyTrending: !prev.onlyTrending }));
  };

  const togglePopular = () => {
    setFilterState(prev => ({ ...prev, onlyPopular: !prev.onlyPopular }));
  };

  const resetFilters = () => {
    setFilterState(initialFilterState);
    setActiveViewTab('all');
  };

  // Filter computation
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Search query
      if (filterState.searchQuery.trim()) {
        const query = filterState.searchQuery.toLowerCase();
        const matchTitle = event.title.toLowerCase().includes(query);
        const matchVenue = event.venue.toLowerCase().includes(query);
        const matchCity = event.city.toLowerCase().includes(query);
        const matchGenre = event.genre.toLowerCase().includes(query);
        const matchArtist = event.artists.some(a => a.name.toLowerCase().includes(query));
        if (!matchTitle && !matchVenue && !matchCity && !matchGenre && !matchArtist) {
          return false;
        }
      }

      // City filter
      if (filterState.city !== 'All Cities') {
        if (!event.city.toLowerCase().includes(filterState.city.toLowerCase())) {
          return false;
        }
      }

      // Genre filter
      if (filterState.selectedGenres.length > 0) {
        const matchesAnyGenre = filterState.selectedGenres.some(g =>
          event.genre.toLowerCase().includes(g.toLowerCase())
        );
        if (!matchesAnyGenre) {
          return false;
        }
      }

      // Date range filter
      if (filterState.startDate) {
        if (event.rawDate < filterState.startDate) {
          return false;
        }
      }
      if (filterState.endDate) {
        if (event.rawDate > filterState.endDate) {
          return false;
        }
      }

      // View Tab
      if (activeViewTab === 'popular' && !event.isPopular) {
        return false;
      }
      if (activeViewTab === 'trending' && !event.isTrending) {
        return false;
      }

      return true;
    });
  }, [events, filterState, activeViewTab]);

  const getEventById = (id: string) => {
    return events.find(e => e.id === id);
  };

  return (
    <EventContext.Provider
      value={{
        events,
        filteredEvents,
        isLoading,
        filterState,
        setSearchQuery,
        setStartDate,
        setEndDate,
        toggleGenre,
        clearGenres,
        setCity,
        toggleTrending,
        togglePopular,
        resetFilters,
        isFilterOpen,
        setIsFilterOpen,
        activeViewTab,
        setActiveViewTab,
        refreshEvents: loadEvents,
        getEventById
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};
