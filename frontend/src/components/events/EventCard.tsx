import React from 'react';
import { Link } from 'react-router-dom';
import { EventItem } from '../../types';
import { formatPriceShort } from '../../services/eventService';

export interface EventDate {
  /** "13.12": the date mark used on every card. */
  dayMonth: string;
  /** "13/12/2025" */
  full: string;
  weekday: string;
  /** "T7" style short weekday for tight cards. */
  weekdayShort: string;
  year: number;
  time: string;
}

export function eventDate(iso: string): EventDate {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  return {
    dayMonth: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`,
    full: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    weekdayShort: d.getDay() === 0 ? 'CN' : `T${d.getDay() + 1}`,
    year: d.getFullYear(),
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  };
}

export function priceFromText(event: EventItem): string | null {
  return event.priceStart > 0 ? `Từ ${formatPriceShort(event.priceStart)}` : null;
}

/** Small genre label. `onImage` sits on a photo, the default on the page. */
export const GenreTag: React.FC<{ genre: string; onImage?: boolean }> = ({ genre, onImage = false }) => (
  <span
    className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
      onImage ? 'bg-white/15 text-white ring ring-white/25 backdrop-blur-sm' : 'bg-violet/12 text-violet-ink'
    }`}
  >
    {genre}
  </span>
);

/**
 * The lead card of the featured grid: the photo carries the card, information sits on it, and the
 * card offers the purchase step directly. The title link covers the card, so the whole card opens
 * the event page while the ticket button stays its own target.
 */
export const EventFeatureCard: React.FC<{ event: EventItem; ticketsUrl: string; className?: string }> = ({ event, ticketsUrl, className = '' }) => {
  const when = eventDate(event.rawDate);
  const price = priceFromText(event);
  return (
    <article className={`group relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden bg-midnight text-white ${className}`}>
      <div className="zoom-frame absolute inset-0 -z-10">
        <img src={event.imageUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover object-[center_30%]" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-midnight via-midnight/55 to-transparent" />

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <GenreTag genre={event.genre} onImage />
          <span className="text-sm text-white/80">
            {when.weekday}, {when.full}
          </span>
        </div>
        <h3 className="type-display mt-3 max-w-xl text-display-sm text-white">
          <Link to={`/event/${event.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {event.title}
          </Link>
        </h3>
        <p className="mt-2 text-white/80">
          {when.time} tại {event.venue}, {event.city}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link to={ticketsUrl} className="btn btn-primary relative z-10">
            Chọn vé
          </Link>
          {price && <span className="type-figure text-lg">{price}</span>}
        </div>
      </div>
    </article>
  );
};

/** The standard card: one photo ratio everywhere, date mark, genre, title, place, price. */
export const EventTile: React.FC<{ event: EventItem; className?: string; compact?: boolean }> = ({ event, className = '', compact = false }) => {
  const when = eventDate(event.rawDate);
  const price = priceFromText(event);
  return (
    <Link to={`/event/${event.id}`} className={`group block ${className}`}>
      <div className="zoom-frame relative aspect-[16/10] bg-kumo-fill">
        <img src={event.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        <span className="type-figure absolute bottom-0 left-0 bg-kumo-canvas px-2.5 pt-1.5 text-xl leading-none text-violet-ink">
          {when.dayMonth}
          <span className="ml-1.5 align-middle font-sans text-xs font-medium text-kumo-subtle">{when.weekdayShort}</span>
        </span>
      </div>
      <div className="pt-3">
        <h3
          className={`type-display line-clamp-2 leading-snug underline-offset-[0.14em] group-hover:underline ${
            compact ? 'text-base' : 'text-lg'
          }`}
        >
          {event.title}
        </h3>
        <p className="mt-1 truncate text-sm text-kumo-subtle">
          {event.venue}, {event.city}
        </p>
        <p className="mt-2 flex items-center justify-between gap-3">
          <span className="type-figure text-base text-kumo-strong">{price ?? ''}</span>
          <GenreTag genre={event.genre} />
        </p>
      </div>
    </Link>
  );
};

export const EventTileSkeleton: React.FC = () => (
  <div aria-hidden="true">
    <div className="skeleton aspect-[16/10] rounded-none" />
    <div className="skeleton mt-3 h-5 w-4/5" />
    <div className="skeleton mt-2 h-4 w-1/2" />
  </div>
);
