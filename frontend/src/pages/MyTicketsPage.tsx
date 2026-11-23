import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { TicketStub, describePlaces } from '../components/TicketStub';
import { TicketQr } from '../components/TicketQr';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/eventService';
import { paymentMethodName } from '../services/paymentMethods';
import { Booking } from '../types';

function placesText(booking: Booking): string {
  const { codes, standing } = describePlaces(booking);
  const parts = [...(codes.length > 0 ? [codes.join(' ')] : []), ...standing.map(s => `${s.count} vé đứng`)];
  return parts.length > 0 ? parts.join(', ') : `${booking.quantity} vé`;
}

function purchasedOn(booking: Booking): string {
  const d = new Date(booking.purchasedAt);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** One booking as an event pass: photo, show, places, and the stub with its code. */
const TicketPass: React.FC<{ booking: Booking; onOpen: () => void; onCancel: () => void }> = ({ booking, onOpen, onCancel }) => {
  const confirmed = booking.status === 'confirmed';
  const bought = purchasedOn(booking);
  return (
    <li className="relative grid overflow-hidden rounded-card bg-kumo-base ring ring-kumo-line sm:grid-cols-[11rem_minmax(0,1fr)_13rem]">
      <div className="relative h-36 bg-kumo-recessed sm:h-auto">
        <img
          src={booking.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={`absolute inset-0 size-full object-cover ${confirmed ? '' : 'opacity-40 grayscale'}`}
        />
      </div>

      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
              confirmed ? 'bg-kumo-success-tint text-kumo-success' : 'bg-kumo-danger-tint text-kumo-danger'
            }`}
          >
            {confirmed ? 'Còn hiệu lực' : 'Đã huỷ'}
          </span>
          <span className="text-sm text-kumo-subtle">
            {booking.eventDate}, {booking.eventTime}
          </span>
        </div>
        <h3 className="type-display mt-3 text-xl leading-snug sm:text-2xl">{booking.eventTitle}</h3>
        <p className="mt-1 text-kumo-subtle">
          {booking.venue}
          {booking.city ? `, ${booking.city}` : ''}
        </p>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
          <span className={`type-figure text-3xl leading-none ${confirmed ? 'text-spot' : 'text-kumo-subtle line-through'}`}>
            {placesText(booking)}
          </span>
          <span className="text-sm text-kumo-subtle">{booking.tierName}</span>
        </p>
        <p className="mt-4 text-sm text-kumo-subtle">
          {formatPrice(booking.totalAmount, booking.currency)}, {paymentMethodName(booking.paymentMethod)}
          {bought && `, mua ngày ${bought}`}
        </p>
      </div>

      {/* The stub: perforated from the pass, with the code the gate scans. */}
      <div className="relative flex flex-col justify-between gap-4 border-t-2 border-dashed border-kumo-line p-5 sm:border-t-0 sm:border-l-2 sm:p-6">
        <span aria-hidden="true" className="absolute -top-3.5 -left-3.5 hidden size-7 rounded-full bg-kumo-canvas sm:block" />
        <span aria-hidden="true" className="absolute -bottom-3.5 -left-3.5 hidden size-7 rounded-full bg-kumo-canvas sm:block" />
        <div className="flex items-center gap-4 sm:flex-col sm:items-start">
          <button
            type="button"
            onClick={onOpen}
            disabled={!confirmed}
            aria-label={`Mở mã QR vé ${booking.bookingCode}`}
            className="shrink-0 rounded-lg bg-white p-1.5 transition-transform hover:scale-[1.03] disabled:opacity-30"
          >
            {confirmed ? <TicketQr code={booking.bookingCode} className="size-16" /> : <span className="block size-16" />}
          </button>
          <div>
            <p className="text-xs text-kumo-subtle">Mã vé</p>
            <p className="type-figure text-lg text-kumo-strong">{booking.bookingCode}</p>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <button type="button" onClick={onOpen} disabled={!confirmed} className="btn btn-ink btn-sm flex-1">
            Mở vé
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={!confirmed}
            className="btn btn-quiet btn-sm flex-1 hover:bg-kumo-danger-tint hover:text-kumo-danger"
          >
            Huỷ vé
          </button>
        </div>
      </div>
    </li>
  );
};

export const MyTicketsPage: React.FC = () => {
  const { bookings, cancelBooking } = useAuth();
  const [openTicket, setOpenTicket] = useState<Booking | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<Booking | null>(null);
  const [tab, setTab] = useState<'active' | 'cancelled'>('active');

  const active = bookings.filter(b => b.status === 'confirmed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');
  const shown = tab === 'active' ? active : cancelled;

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
    <PageShell tone="stage">
      <Navbar tone="stage" />

      <main className="page-enter mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
        <h1 className="type-display text-display-lg">Vé của tôi</h1>
        <p className="mt-3 text-kumo-subtle">Mở vé để lấy mã QR khi tới cổng soát vé.</p>

        {bookings.length === 0 ? (
          <EmptyState
            className="mt-10"
            title="Bạn chưa có vé nào"
            body="Vé bạn mua sẽ nằm ở đây, kèm mã QR để vào cổng."
            action={
              <Link to="/" className="btn btn-primary">
                Xem lịch diễn
              </Link>
            }
          />
        ) : (
          <>
            <div role="tablist" aria-label="Trạng thái vé" className="mt-10 flex gap-2">
              {([
                ['active', 'Còn hiệu lực', active.length],
                ['cancelled', 'Đã huỷ', cancelled.length]
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`tab-${value}`}
                  aria-selected={tab === value}
                  aria-controls="ticket-panel"
                  onClick={() => setTab(value)}
                  className="chip"
                >
                  {label}
                  <span className="type-figure opacity-70">{count}</span>
                </button>
              ))}
            </div>

            <div id="ticket-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
              {shown.length === 0 ? (
                <EmptyState
                  title={tab === 'active' ? 'Không có vé nào còn hiệu lực' : 'Chưa huỷ vé nào'}
                  body={tab === 'active' ? 'Các vé đã huỷ vẫn xem được ở thẻ bên cạnh.' : undefined}
                />
              ) : (
                <ul className="space-y-5">
                  {shown.map(b => (
                    <TicketPass key={b.id} booking={b} onOpen={() => setOpenTicket(b)} onCancel={() => setTicketToCancel(b)} />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>

      {ticketToCancel && (
        <div
          style={{ zIndex: 'var(--z-modal)' }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            aria-describedby="cancel-body"
            className="fixed inset-x-0 bottom-0 rounded-t-card bg-kumo-raised p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] ring ring-kumo-line motion-safe:animate-[sheet-in_240ms_var(--ease-reveal)] sm:relative sm:max-w-md sm:rounded-card sm:p-8"
          >
            <h2 id="cancel-title" className="type-display text-title">
              Huỷ vé {placesText(ticketToCancel)}?
            </h2>
            <p id="cancel-body" className="mt-3 text-kumo-subtle">
              Vé {ticketToCancel.bookingCode} cho {ticketToCancel.eventTitle} sẽ không dùng được nữa. Thao tác này không hoàn tác được.
            </p>
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" autoFocus onClick={() => setTicketToCancel(null)} className="btn btn-secondary">
                Giữ vé
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelBooking(ticketToCancel.id);
                  setTicketToCancel(null);
                }}
                className="btn btn-danger"
              >
                Huỷ vé
              </button>
            </div>
          </div>
        </div>
      )}

      {openTicket && (
        <div style={{ zIndex: 'var(--z-modal)' }} className="fixed inset-0 overflow-y-auto bg-black/80 backdrop-blur-sm" onClick={() => setOpenTicket(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Vé ${openTicket.eventTitle}`}
            onClick={e => e.stopPropagation()}
            className="relative mx-auto max-w-md px-4 py-10 motion-safe:animate-[sheet-in_260ms_var(--ease-reveal)]"
          >
            <button type="button" autoFocus onClick={() => setOpenTicket(null)} aria-label="Đóng vé" className="btn-icon mb-3 ml-auto bg-kumo-raised ring ring-kumo-line">
              <X className="size-5" />
            </button>
            <TicketStub booking={openTicket} notches={false} />
            <p className="mt-4 text-center text-sm text-white/80">Đưa mã QR này cho nhân viên soát vé ở cổng.</p>
          </div>
        </div>
      )}

      <Footer />
    </PageShell>
  );
};
