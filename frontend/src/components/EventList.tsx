import React from 'react';
import { EventItem } from '../types';
import { EventCard } from './EventCard';
import { Music, RefreshCw, WifiOff } from 'lucide-react';
import { useEvents } from '../context/EventContext';

interface EventListProps {
  events: EventItem[];
  isLoading?: boolean;
}

export const EventList: React.FC<EventListProps> = ({ events, isLoading }) => {
  const { isFilterOpen, resetFilters, refreshEvents, loadError } = useEvents();

  if (isLoading) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center text-center">
        <div className="size-8 rounded-full border-2 border-kumo-interact border-t-kumo-brand animate-spin mb-4" />
        <p className="text-kumo-subtle text-base">Đang tải danh sách sự kiện âm nhạc...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="w-full py-12 sm:py-16 px-4 rounded-xl bg-kumo-danger-tint ring ring-kumo-line text-center flex flex-col items-center justify-center"
      >
        <div className="size-10 rounded-lg bg-kumo-base ring ring-kumo-line grid place-items-center text-kumo-danger mb-4">
          <WifiOff className="size-5" />
        </div>
        <h3 className="text-lg font-semibold text-kumo-strong mb-1">Chưa tải được danh sách sự kiện</h3>
        <p className="text-base text-kumo-subtle max-w-md mb-6">
          {loadError} Kiểm tra kết nối mạng rồi thử lại.
        </p>
        <button
          onClick={() => refreshEvents()}
          className="h-11 sm:h-9 px-3.5 rounded-lg bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand text-base font-medium flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="size-4" />
          Thử lại
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="w-full py-12 sm:py-16 px-4 rounded-xl bg-kumo-elevated ring ring-kumo-line border-dashed text-center flex flex-col items-center justify-center">
        <div className="size-10 rounded-lg bg-kumo-base ring ring-kumo-line grid place-items-center text-kumo-subtle mb-4">
          <Music className="size-5" />
        </div>
        <h3 className="text-lg font-semibold text-kumo-strong mb-1">Không tìm thấy sự kiện phù hợp</h3>
        <p className="text-base text-kumo-subtle max-w-md mb-6">
          Thử thay đổi từ khóa tìm kiếm, thể loại âm nhạc hoặc mở rộng khoảng ngày để khám phá thêm nhiều concert hấp dẫn.
        </p>
        <div className="flex flex-col min-[400px]:flex-row items-stretch min-[400px]:items-center gap-2 sm:gap-3 w-full min-[400px]:w-auto">
          <button
            onClick={resetFilters}
            className="h-11 sm:h-9 px-3.5 rounded-lg bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand text-base font-medium transition-colors"
          >
            Xóa tất cả bộ lọc
          </button>
          <button
            onClick={() => refreshEvents()}
            className="h-11 sm:h-9 px-3.5 justify-center rounded-lg bg-kumo-base ring ring-kumo-line hover:bg-kumo-tint text-kumo-default text-base font-medium flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="size-4" />
            Tải lại sự kiện
          </button>
        </div>
      </div>
    );
  }

  // Grid responsive: 1 col on mobile, 2 cols on small tablet, 3-4 cols on desktop
  const gridClasses = isFilterOpen
    ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-8'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10';

  return (
    <div className={gridClasses}>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};
