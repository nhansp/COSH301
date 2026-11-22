import React from 'react';
import { Booking } from '../types';
import { TicketQr } from './TicketQr';
import { accentStyle, useEventAccent } from '../hooks/useEventAccent';

const STANDING_SUFFIX = ' · Vé đứng';

/** Seat codes as printed; standing places are counted per zone because they have no fixed spot. */
export function describePlaces(booking: Booking): { codes: string[]; standing: { zone: string; count: number }[] } {
  const labels = booking.seatLabels ?? booking.selectedSeats ?? [];
  const codes = labels.filter(l => !l.endsWith(STANDING_SUFFIX));
  const standing = new Map<string, number>();
  for (const label of labels) {
    if (label.endsWith(STANDING_SUFFIX)) {
      const zone = label.slice(0, -STANDING_SUFFIX.length);
      standing.set(zone, (standing.get(zone) ?? 0) + 1);
    }
  }
  return { codes, standing: Array.from(standing, ([zone, count]) => ({ zone, count })) };
}

interface TicketStubProps {
  booking: Booking;
  /** Plays the one-off reveal used on the confirmation screen. */
  reveal?: boolean;
  /** The notches are cut with the page colour, so they are hidden over a dimmed overlay. */
  notches?: boolean;
}

export const TicketStub: React.FC<TicketStubProps> = ({ booking, reveal = false, notches = true }) => {
  const accent = useEventAccent(booking.imageUrl);
  const { codes, standing } = describePlaces(booking);
  const cancelled = booking.status === 'cancelled';

  return (
    <article
      style={accentStyle(accent)}
      className={`relative overflow-hidden rounded-[20px] bg-kumo-raised shadow-xl ring ring-kumo-line ${
        reveal ? 'motion-safe:animate-[ticket-in_900ms_var(--ease-encore)_both]' : ''
      }`}
    >
      <div className="relative h-32 overflow-hidden bg-kumo-recessed sm:h-40">
        <img
          src={booking.imageUrl}
          alt=""
          className={`size-full object-cover ${cancelled ? 'grayscale' : ''}`}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute bottom-3 left-5 text-sm font-medium text-white/90 sm:left-6">
          {booking.eventDate}, {booking.eventTime}
        </span>
      </div>

      <div className="px-5 pt-4 pb-5 sm:px-6">
        <h2 className="font-display text-2xl leading-tight font-bold text-balance text-kumo-strong [font-stretch:112%]">
          {booking.eventTitle}
        </h2>
        <p className="mt-1 text-kumo-subtle">{booking.venue}</p>
      </div>

      {/* Tear line: two half-circle notches cut by the page colour. */}
      <div aria-hidden="true" className="relative mx-5 border-t-2 border-dashed border-kumo-line">
        {notches && (
          <>
            <span className="absolute -top-3 -left-8 size-6 rounded-full bg-kumo-canvas" />
            <span className="absolute -top-3 -right-8 size-6 rounded-full bg-kumo-canvas" />
          </>
        )}
      </div>

      <div className="relative grid gap-5 py-5 pr-5 pl-7 sm:grid-cols-[1fr_auto] sm:pr-6 sm:pl-8">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-accent" />
        <div className="min-w-0 space-y-4">
          <div>
            <div className="text-sm text-kumo-subtle">Vị trí</div>
            <div className="relative">
              {codes.length > 0 && (
                <p className="font-display text-5xl leading-none font-bold tabular-nums text-kumo-strong [font-stretch:68%]">
                  {codes.join(' ')}
                </p>
              )}
              {standing.map(group => (
                <p key={group.zone} className="font-display text-2xl leading-tight font-bold text-kumo-strong [font-stretch:80%]">
                  {group.count} vé đứng · {group.zone}
                </p>
              ))}
              {codes.length === 0 && standing.length === 0 && (
                <p className="font-display text-2xl font-bold text-kumo-strong [font-stretch:80%]">
                  {booking.quantity} vé · {booking.tierName}
                </p>
              )}
              {reveal && <span aria-hidden="true" className="spot-sweep pointer-events-none absolute -inset-2" />}
            </div>
            {codes.length > 0 && <p className="mt-1 text-sm text-kumo-subtle">{booking.tierName}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-kumo-subtle">Người tham dự</dt>
              <dd className="font-medium break-words text-kumo-default">{booking.attendeeName}</dd>
            </div>
            <div>
              <dt className="text-kumo-subtle">Mã vé</dt>
              <dd className="font-display text-base font-semibold tabular-nums text-kumo-strong [font-stretch:80%]">
                {booking.bookingCode}
              </dd>
            </div>
          </dl>
        </div>

        {/* White in both themes so gate scanners read it. */}
        <div className="flex flex-col items-center self-start justify-self-center rounded-xl bg-white p-3">
          {cancelled ? (
            <div className="grid size-32 place-items-center text-center text-sm font-medium text-neutral-500">Vé đã huỷ</div>
          ) : (
            <TicketQr code={booking.bookingCode} className="size-32" />
          )}
        </div>
      </div>
    </article>
  );
};
