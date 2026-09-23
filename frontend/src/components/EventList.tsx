import React from 'react';
import { EventItem } from '../types';
import { EventCard } from './EventCard';
import { Music, RefreshCw } from 'lucide-react';
import { useEvents } from '../context/EventContext';

interface EventListProps {
  events: EventItem[];
  isLoading?: boolean;
}

export const EventList: React.FC<EventListProps> = ({ events, isLoading }) => {
  const { isFilterOpen, resetFilters, refreshEvents } = useEvents();

  if (isLoading) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
        <p className="text-purple-300 font-medium text-sm">Đang tải danh sách sự kiện âm nhạc...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="w-full py-16 px-4 rounded-3xl bg-[#1a0c2e]/60 border border-purple-900/40 text-center flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-purple-900/30 flex items-center justify-center text-purple-400 mb-4">
          <Music className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Không tìm thấy sự kiện phù hợp</h3>
        <p className="text-sm text-purple-300/70 max-w-md mb-6">
          Thử thay đổi từ khóa tìm kiếm, thể loại âm nhạc hoặc mở rộng khoảng ngày để khám phá thêm nhiều concert hấp dẫn.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={resetFilters}
            className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm transition-all"
          >
            Xóa tất cả bộ lọc
          </button>
          <button
            onClick={() => refreshEvents()}
            className="px-4 py-2.5 rounded-full bg-purple-950/60 border border-purple-800/60 text-purple-200 hover:text-white text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tải lại sự kiện
          </button>
        </div>
      </div>
    );
  }

  // Grid responsive: 1 col on mobile, 2 cols on small tablet, 3-4 cols on desktop
  const gridClasses = isFilterOpen
    ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-7'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 sm:gap-8';

  return (
    <div className={gridClasses}>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};
