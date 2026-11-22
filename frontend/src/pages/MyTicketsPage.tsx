import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { TicketStub, describePlaces } from '../components/TicketStub';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/eventService';
import { Booking } from '../types';

const secondaryButton =
  'inline-flex h-11 items-center justify-center rounded-lg bg-kumo-base px-4 font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-40';
const primaryButton =
  'inline-flex h-11 items-center justify-center rounded-lg bg-kumo-contrast px-4 font-semibold text-kumo-inverse transition-opacity hover:opacity-90';

function placesText(booking: Booking): string {
  const { codes, standing } = describePlaces(booking);
  const parts = [...(codes.length > 0 ? [codes.join(' ')] : []), ...standing.map(s => `${s.count} vé đứng`)];
  return parts.length > 0 ? parts.join(' · ') : `${booking.quantity} vé`;
}

const TicketRow: React.FC<{ booking: Booking; onOpen: () => void; onCancel: () => void }> = ({ booking, onOpen, onCancel }) => {
  const confirmed = booking.status === 'confirmed';
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <img
        src={booking.imageUrl}
        alt=""
        className={`aspect-square w-full object-cover ${confirmed ? '' : 'opacity-50 grayscale'}`}
        referrerPolicy="no-referrer"
      />
      <div className="min-w-0">
        <p className="text-sm text-kumo-subtle">
          {booking.eventDate}, {booking.eventTime}
        </p>
        <h3 className="mt-0.5 font-display text-lg leading-snug font-semibold text-kumo-strong [font-stretch:105%]">
          {booking.eventTitle}
        </h3>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span
            className={`font-display text-2xl font-bold tabular-nums [font-stretch:68%] ${
              confirmed ? 'text-kumo-strong' : 'text-kumo-subtle line-through'
            }`}
          >
            {placesText(booking)}
          </span>
          <span className="text-sm text-kumo-subtle">{booking.tierName}</span>
        </p>
        <p className="mt-1 text-sm text-kumo-subtle">
          Mã vé <span className="font-medium text-kumo-default tabular-nums">{booking.bookingCode}</span> ·{' '}
          {formatPrice(booking.totalAmount, booking.currency)}
          {!confirmed && <span className="text-kumo-danger"> · Đã huỷ</span>}
        </p>
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-1 sm:flex-col">
        <button type="button" onClick={onOpen} className={`${primaryButton} flex-1 sm:flex-none`} disabled={!confirmed}>
          Mở vé
        </button>
        <button type="button" onClick={onCancel} disabled={!confirmed} className={`${secondaryButton} flex-1 hover:text-kumo-danger sm:flex-none`}>
          Huỷ vé
        </button>
      </div>
    </li>
  );
};

export const MyTicketsPage: React.FC = () => {
  const { bookings, cancelBooking } = useAuth();
  const [openTicket, setOpenTicket] = useState<Booking | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<Booking | null>(null);

  const active = bookings.filter(b => b.status === 'confirmed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');

  useEffect(() => {
    if (!openTicket && !ticketToCancel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenTicket(null);
        setTicketToCancel(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTicket, ticketToCancel]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight text-kumo-strong [font-stretch:118%] sm:text-display-sm">
          Vé của tôi
        </h1>

        {bookings.length === 0 ? (
          <div className="mt-8 border-y border-kumo-hairline py-12">
            <p className="text-lg text-kumo-default">Bạn chưa có vé nào.</p>
            <Link to="/" className={`${primaryButton} mt-4`}>
              Xem lịch diễn
            </Link>
          </div>
        ) : (
          <>
            <section aria-labelledby="active-tickets" className="mt-8">
              <h2 id="active-tickets" className="mb-1 text-kumo-subtle">
                Còn hiệu lực · {active.length}
              </h2>
              {active.length === 0 ? (
                <p className="border-y border-kumo-hairline py-6 text-kumo-default">Không có vé nào còn hiệu lực.</p>
              ) : (
                <ul className="divide-y divide-kumo-hairline border-y border-kumo-hairline">
                  {active.map(b => (
                    <TicketRow key={b.id} booking={b} onOpen={() => setOpenTicket(b)} onCancel={() => setTicketToCancel(b)} />
                  ))}
                </ul>
              )}
            </section>

            {cancelled.length > 0 && (
              <section aria-labelledby="cancelled-tickets" className="mt-12">
                <h2 id="cancelled-tickets" className="mb-1 text-kumo-subtle">
                  Đã huỷ · {cancelled.length}
                </h2>
                <ul className="divide-y divide-kumo-hairline border-y border-kumo-hairline">
                  {cancelled.map(b => (
                    <TicketRow key={b.id} booking={b} onOpen={() => setOpenTicket(b)} onCancel={() => setTicketToCancel(b)} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      {ticketToCancel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            aria-describedby="cancel-body"
            className="fixed inset-x-0 bottom-0 rounded-t-2xl bg-kumo-raised p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl ring ring-kumo-line sm:relative sm:max-w-md sm:rounded-2xl"
          >
            <h2 id="cancel-title" className="font-display text-xl font-semibold text-kumo-strong [font-stretch:110%]">
              Huỷ vé {placesText(ticketToCancel)}?
            </h2>
            <p id="cancel-body" className="mt-2 text-kumo-subtle">
              Vé {ticketToCancel.bookingCode} cho {ticketToCancel.eventTitle} sẽ không dùng được nữa. Thao tác này không hoàn tác được.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" autoFocus onClick={() => setTicketToCancel(null)} className={secondaryButton}>
                Giữ vé
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelBooking(ticketToCancel.id);
                  setTicketToCancel(null);
                }}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-kumo-danger px-4 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Huỷ vé
              </button>
            </div>
          </div>
        </div>
      )}

      {openTicket && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={() => setOpenTicket(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Vé ${openTicket.eventTitle}`}
            onClick={e => e.stopPropagation()}
            className="relative mx-auto max-w-md px-4 py-10"
          >
            <button
              type="button"
              autoFocus
              onClick={() => setOpenTicket(null)}
              aria-label="Đóng vé"
              className="mb-3 ml-auto grid size-11 place-items-center rounded-full bg-kumo-raised text-kumo-default ring ring-kumo-line hover:bg-kumo-tint"
            >
              <X className="size-5" />
            </button>
            <TicketStub booking={openTicket} notches={false} />
            <p className="mt-4 text-center text-sm text-white/80">Đưa mã QR này cho nhân viên soát vé ở cổng.</p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
