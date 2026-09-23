import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, MapPin, Ticket, ExternalLink, ArrowRight } from 'lucide-react';
import { EventItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatPrice, DEFAULT_EVENT_IMAGE } from '../services/eventService';

interface EventCardProps {
  event: EventItem;
  onSelectEvent?: (event: EventItem) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelectEvent }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleBuyTickets = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering parent card click

    if (onSelectEvent) {
      onSelectEvent(event);
    }

    // Check authentication requirement strictly as specified in Phase 3
    if (!isAuthenticated) {
      // Redirect to login with redirect param
      navigate(`/login?redirect=${encodeURIComponent(`/checkout/${event.id}`)}`);
    } else {
      // Already authenticated -> proceed directly to checkout
      navigate(`/checkout/${event.id}`);
    }
  };

  const handleViewDetail = () => {
    navigate(`/event/${event.id}`);
  };

  return (
    <div
      onClick={handleViewDetail}
      className="group relative flex flex-col rounded-2xl bg-transparent transition-all duration-300 cursor-pointer"
    >
      {/* Event Poster Image matching Picture.webp */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#1f1136] border border-purple-900/40 shadow-lg group-hover:border-purple-600/50 group-hover:shadow-purple-900/20 transition-all duration-300">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== DEFAULT_EVENT_IMAGE) {
              target.src = DEFAULT_EVENT_IMAGE;
            }
          }}
        />

        {/* Subtle dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12091c]/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Genre Pill on top-right */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#160a26]/80 backdrop-blur-md border border-purple-700/40 text-[11px] font-medium text-purple-200">
          {event.genre}
        </div>

        {/* Quick View Button overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40 backdrop-blur-[2px]">
          <span className="px-4 py-2 rounded-full bg-white/90 text-[#12091c] text-xs font-bold shadow-xl flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <span>Chi tiết sự kiện</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* Card Content info matching Picture.webp */}
      <div className="pt-3 pb-1 flex flex-col flex-1">
        {/* Date & Time in violet/pinkish text */}
        <div className="text-xs font-semibold text-purple-400 tracking-wide mb-1">
          {event.date}, {event.time}
        </div>

        {/* Event Title */}
        <h3 className="text-base font-bold text-white leading-snug line-clamp-1 group-hover:text-purple-300 transition-colors">
          {event.title}
        </h3>

        {/* Venue & Location */}
        <p className="text-xs text-purple-300/70 mt-1 flex items-center gap-1 line-clamp-1">
          <MapPin className="w-3 h-3 text-purple-400/80 flex-shrink-0" />
          <span>{event.venue}</span>
        </p>

        {/* Price & Trending badge */}
        <div className="mt-2.5 flex items-center justify-between text-xs font-medium">
          <div className="text-purple-100 font-bold text-sm">
            {formatPrice(event.priceStart, event.currency)}
          </div>

          {event.isTrending && (
            <div className="flex items-center gap-1 text-pink-400 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
              <span>Trending Now</span>
            </div>
          )}
        </div>

        {/* Prominent "Mua vé ngay" (Buy Tickets) Action Button */}
        <div className="mt-3 pt-2.5 border-t border-purple-950/80 flex items-center gap-2">
          <button
            onClick={handleBuyTickets}
            className="w-full py-2 px-3.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-purple-900/40 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 text-purple-200" />
            <span>Mua vé ngay</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
};
