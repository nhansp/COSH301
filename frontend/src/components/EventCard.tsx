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
      className="group relative flex flex-col cursor-pointer"
    >
      <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-xl overflow-hidden bg-kumo-recessed ring ring-kumo-line group-hover:ring-kumo-interact transition-shadow">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== DEFAULT_EVENT_IMAGE) {
              target.src = DEFAULT_EVENT_IMAGE;
            }
          }}
        />

        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-xs font-medium text-white">
          {event.genre}
        </span>
      </div>

      <div className="pt-3 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 text-sm text-kumo-subtle tabular-nums">
          <span className="truncate">
            {event.date}, {event.time}
          </span>
          {event.isTrending && (
            <span className="flex flex-shrink-0 items-center gap-1 text-kumo-default font-medium">
              <Flame className="size-3.5" />
              Trending
            </span>
          )}
        </div>

        <h3 className="mt-1 text-lg font-semibold text-kumo-strong leading-snug tracking-tight line-clamp-1 group-hover:underline underline-offset-2 decoration-kumo-interact">
          {event.title}
        </h3>

        <p className="mt-0.5 text-sm text-kumo-subtle flex items-center gap-1 min-w-0">
          <MapPin className="size-3.5 flex-shrink-0" />
          <span className="truncate">{event.venue}</span>
        </p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-base text-kumo-subtle">
            {event.priceStart > 0 && 'Từ '}
            <span className="font-semibold text-kumo-strong tabular-nums">
              {formatPrice(event.priceStart, event.currency)}
            </span>
          </p>
          <button
            onClick={handleBuyTickets}
            className="h-11 sm:h-8 px-3 flex-shrink-0 rounded-lg bg-kumo-base ring ring-kumo-line text-sm font-medium text-kumo-default hover:bg-kumo-brand hover:text-kumo-on-brand hover:ring-transparent transition-colors flex items-center gap-1.5"
          >
            <Ticket className="size-3.5" />
            Mua vé
          </button>
        </div>
      </div>
    </article>
  );
};
