import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, MapPin, Ticket } from 'lucide-react';
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
    <article
      onClick={handleViewDetail}
      className="group relative flex flex-col cursor-pointer rounded-2xl p-2.5 -m-2.5 transition-all duration-200 hover:bg-kumo-base/80 active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-xl overflow-hidden bg-kumo-recessed ring-1 ring-emerald-500/20 group-hover:ring-emerald-500/60 group-hover:shadow-lg group-hover:shadow-emerald-950/10 transition-all">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== DEFAULT_EVENT_IMAGE) {
              target.src = DEFAULT_EVENT_IMAGE;
            }
          }}
        />

        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-xs font-medium text-emerald-300 border border-emerald-500/30">
          {event.genre}
        </span>
      </div>

      <div className="pt-3 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 text-sm text-kumo-subtle tabular-nums">
          <span className="truncate">
            {event.date}, {event.time}
          </span>
          {event.isTrending && (
            <span className="flex flex-shrink-0 items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
              <Flame className="size-3.5 fill-emerald-500/30" />
              Hot
            </span>
          )}
        </div>

        <h3 className="mt-1 text-lg font-semibold text-kumo-strong leading-snug tracking-tight line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
          {event.title}
        </h3>

        <p className="mt-0.5 text-sm text-kumo-subtle flex items-center gap-1 min-w-0">
          <MapPin className="size-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">{event.venue}</span>
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-kumo-hairline">
          <p className="text-sm text-kumo-subtle">
            {event.priceStart > 0 && 'Từ '}
            <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums text-base">
              {formatPrice(event.priceStart, event.currency)}
            </span>
          </p>
          <button
            onClick={handleBuyTickets}
            className="h-10 sm:h-8 px-3.5 flex-shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Ticket className="size-3.5" />
            Mua vé
          </button>
        </div>
      </div>
    </article>
  );
};
