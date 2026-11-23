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

/** The full ticket: what the gate staff scan. Always a stage surface, whatever page it sits on. */
export const TicketStub: React.FC<TicketStubProps> = ({ booking, reveal = false, notches = true }) => {
  const accent = useEventAccent(booking.imageUrl);
  const { codes, standing } = describePlaces(booking);
  const cancelled = booking.status === 'cancelled';

  return (
    <article
      data-mode="dark"
      style={accentStyle(accent)}
      className={`@container relative overflow-hidden rounded-card bg-plum text-kumo-default shadow-[var(--shadow-lift)] ring ring-kumo-line ${
        reveal ? 'motion-safe:animate-[ticket-in_900ms_var(--ease-encore)_both]' : ''
      }`}
    >
      <div className="relative h-36 overflow-hidden bg-kumo-recessed sm:h-44">
        <img src={booking.imageUrl} alt="" className={`size-full object-cover ${cancelled ? 'grayscale' : ''}`} referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-plum via-plum/30 to-transparent" />
      </div>

      <div className="relative -mt-12 px-6 pb-5 sm:px-7">
        <p className="text-sm text-kumo-subtle">
          {booking.eventDate}, {booking.eventTime}
        </p>
        <h2 className="type-display mt-1 text-2xl leading-tight sm:text-3xl">{booking.eventTitle}</h2>
        <p className="mt-1 text-kumo-subtle">{booking.venue}</p>
      </div>

      {/* Tear line: two half-circle notches cut by the page colour. */}
      <div aria-hidden="true" className="relative mx-6 border-t-2 border-dashed border-kumo-line">
        {notches && (
          <>
            <span className="absolute -top-3.5 -left-9.5 size-7 rounded-full bg-kumo-canvas" />
            <span className="absolute -top-3.5 -right-9.5 size-7 rounded-full bg-kumo-canvas" />
          </>
        )}
      </div>

      <div className="relative grid gap-6 py-6 pr-6 pl-8 sm:grid-cols-[1fr_auto] sm:pr-7 sm:pl-9">
        <span aria-hidden="true" className="absolute inset-y-6 left-0 w-1.5 rounded-r-full bg-accent" />
        <div className="min-w-0 space-y-5">
          <div>
            <div className="text-sm text-kumo-subtle">Vị trí</div>
            <div className="relative mt-1">
              {codes.length > 0 && <p className="type-figure text-5xl leading-none text-spot">{codes.join(' ')}</p>}
              {standing.map(group => (
                <p key={group.zone} className="type-display text-2xl leading-tight text-spot">
                  {group.count} vé đứng, {group.zone}
                </p>
              ))}
              {codes.length === 0 && standing.length === 0 && (
                <p className="type-display text-2xl text-spot">
                  {booking.quantity} vé {booking.tierName}
                </p>
              )}
              {reveal && <span aria-hidden="true" className="spot-sweep pointer-events-none absolute -inset-2" />}
            </div>
            {codes.length > 0 && <p className="mt-2 text-sm text-kumo-subtle">{booking.tierName}</p>}
          </div>
          {/* Side by side only when the ticket is wide enough; in the narrow dialog they stack. */}
          <dl className="grid gap-x-4 gap-y-3 text-sm @lg:grid-cols-2">
            <div>
              <dt className="text-kumo-subtle">Người tham dự</dt>
              <dd className="mt-0.5 font-medium break-words text-kumo-strong">{booking.attendeeName}</dd>
            </div>
            <div>
              <dt className="text-kumo-subtle">Mã vé</dt>
              <dd className="type-figure mt-0.5 text-base text-kumo-strong">{booking.bookingCode}</dd>
            </div>
          </dl>
        </div>

        {/* White in every theme so gate scanners read it. */}
        <div className="flex flex-col items-center self-start justify-self-center rounded-xl bg-white p-3">
          {cancelled ? (
            <div className="grid size-36 place-items-center text-center text-sm font-medium text-neutral-500">Vé đã huỷ</div>
          ) : (
            <TicketQr code={booking.bookingCode} className="size-36" />
          )}
        </div>
      </div>
    </article>
  );
};
