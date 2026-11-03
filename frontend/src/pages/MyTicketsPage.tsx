import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { TicketQr } from '../components/TicketQr';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/eventService';
import { Booking } from '../types';
import {
  Ticket,
  Calendar,
  Clock,
  MapPin,
  Download,
  ArrowLeft,
  X,
  ShieldCheck,
  CheckCircle2,
  Armchair
} from 'lucide-react';

export const MyTicketsPage: React.FC = () => {
  const { bookings, cancelBooking, user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<Booking | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<Booking | null>(null);


  const secondaryButtonClass =
    'flex h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-kumo-base px-3 font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-50';
  const primaryButtonClass =
    'flex h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-kumo-brand px-3.5 font-medium text-kumo-on-brand transition-colors hover:bg-kumo-brand-hover';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 w-full min-w-0 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Link
              to="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1.5 -ml-1.5 mb-2 sm:mb-3 text-sm text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Khám phá thêm sự kiện</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-strong">
              Vé sự kiện của tôi
            </h1>
            <p className="text-kumo-subtle mt-1">
              Quản lý vé đã mua, xuất trình mã QR tại cửa và xem lịch trình concert
            </p>
          </div>

          <span className="hidden sm:inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-kumo-tint ring ring-kumo-line text-kumo-default tabular-nums">
            Tổng số vé: {bookings.length}
          </span>
        </div>

        {bookings.length === 0 ? (
          <div className="py-12 sm:py-16 px-4 sm:px-6 text-center rounded-xl bg-kumo-base ring ring-kumo-line">
            <div className="size-12 rounded-lg bg-kumo-recessed ring ring-kumo-line text-kumo-subtle grid place-items-center mx-auto mb-4">
              <Ticket className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-kumo-strong mb-1">Bạn chưa có vé sự kiện nào</h3>
            <p className="text-kumo-subtle max-w-sm mx-auto mb-6">
              Khám phá danh sách concert, EDM festival và các đêm nhạc acoustic đang mở bán vé ngay hôm nay!
            </p>
            <Link to="/" className={`${primaryButtonClass} inline-flex`}>
              Mua vé concert ngay
            </Link>
          </div>
        ) : (
          <ul className="rounded-xl bg-kumo-base ring ring-kumo-line divide-y divide-kumo-hairline">
            {bookings.map(booking => {
              const confirmed = booking.status === 'confirmed';
              return (
                <li
                  key={booking.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <img
                      src={booking.imageUrl}
                      alt={booking.eventTitle}
                      className={`size-16 sm:size-20 rounded-lg object-cover ring ring-kumo-line flex-shrink-0 ${
                        confirmed ? '' : 'grayscale opacity-60'
                      }`}
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="max-w-full truncate rounded-md px-1.5 py-0.5 bg-kumo-recessed text-xs font-medium text-kumo-default tabular-nums">
                          {booking.bookingCode}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            confirmed
                              ? 'bg-kumo-success-tint text-kumo-success'
                              : 'bg-kumo-danger-tint text-kumo-danger'
                          }`}
                        >
                          {confirmed ? 'Đã xác nhận' : 'Đã hủy'}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-semibold tracking-tight text-kumo-strong mt-1.5 line-clamp-2 sm:truncate">
                        {booking.eventTitle}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-kumo-subtle mt-0.5">
                        <span className="flex flex-wrap items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{booking.eventDate}</span>
                          <span>{booking.eventTime}</span>
                        </span>
                        <span className="flex items-center gap-1 min-w-0">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate sm:max-w-[200px]">{booking.venue}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-kumo-default mt-1.5">
                        <span>
                          Hạng vé: <span className="font-medium">{booking.tierName}</span>{' '}
                          <span className="text-kumo-subtle tabular-nums">({booking.quantity} vé)</span>
                        </span>
                        <span>
                          Tổng:{' '}
                          <span className="font-semibold tabular-nums">
                            {formatPrice(booking.totalAmount, booking.currency)}
                          </span>
                        </span>
                      </div>
                      {booking.selectedSeats && booking.selectedSeats.length > 0 && (
                        <div className="text-sm text-kumo-subtle mt-1 flex items-start gap-1.5 min-w-0">
                          <Armchair className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span className="min-w-0 break-words">
                            Vị trí ghế:{' '}
                            <strong className="font-medium text-kumo-default tabular-nums">
                              {booking.selectedSeats.join(', ')}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:justify-end">
                    <button
                      onClick={() => setSelectedTicket(booking)}
                      className={primaryButtonClass}
                    >
                      Xem mã QR vé
                    </button>

                    <button
                      onClick={() => setTicketToCancel(booking)}
                      disabled={booking.status === 'cancelled'}
                      className={`${secondaryButtonClass} hover:text-kumo-danger`}
                    >
                      Hủy vé
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Cancel Confirmation Modal */}
      {ticketToCancel && (
        <div className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-ticket-title"
            className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-kumo-raised p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg ring ring-kumo-line sm:relative sm:inset-auto sm:w-full sm:rounded-xl sm:p-6 sm:max-w-sm"
          >
            <h3 id="cancel-ticket-title" className="text-lg font-semibold tracking-tight text-kumo-strong mb-2">
              Xác nhận hủy đặt vé?
            </h3>
            <p className="text-kumo-subtle mb-6">
              Bạn có chắc chắn muốn hủy vé <strong className="font-medium text-kumo-default">{ticketToCancel.eventTitle}</strong>{' '}
              (Mã: <span className="tabular-nums">{ticketToCancel.bookingCode}</span>)? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <button onClick={() => setTicketToCancel(null)} className={secondaryButtonClass}>
                Không, giữ lại
              </button>
              <button
                onClick={() => {
                  cancelBooking(ticketToCancel.id);
                  setTicketToCancel(null);
                }}
                className="flex h-11 sm:h-9 items-center justify-center rounded-lg bg-kumo-danger px-3.5 font-medium text-white transition-opacity hover:opacity-90"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details & QR Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-qr-title"
            className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-kumo-raised p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg ring ring-kumo-line sm:relative sm:inset-auto sm:w-full sm:rounded-xl sm:p-6 sm:max-w-md text-center"
          >
            <button
              onClick={() => setSelectedTicket(null)}
              aria-label="Đóng"
              className="absolute top-3 right-3 grid size-11 sm:size-8 place-items-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 bg-kumo-success-tint text-kumo-success text-xs font-medium mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Vé chính hãng hợp lệ</span>
            </div>

            <h3 id="ticket-qr-title" className="px-8 text-xl font-semibold tracking-tight text-kumo-strong">
              {selectedTicket.eventTitle}
            </h3>
            <p className="text-kumo-subtle mt-0.5">{selectedTicket.venue}</p>
            <p className="text-kumo-subtle mt-0.5 flex flex-wrap items-center justify-center gap-x-2">
              <span>{selectedTicket.eventDate}</span>
              <span>{selectedTicket.eventTime}</span>
            </p>

            {/* QR Code: white well in both themes so scanners read it reliably */}
            <div className="my-5 p-3 rounded-lg bg-white ring ring-kumo-line size-56 sm:size-48 mx-auto flex items-center justify-center">
              <TicketQr code={selectedTicket.bookingCode} className="w-full h-full object-contain" />
            </div>

            <dl className="rounded-lg bg-kumo-recessed p-3 text-sm text-left grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 sm:gap-y-1.5">
              <dt className="text-kumo-subtle">Mã vé</dt>
              <dd className="mb-2 sm:mb-0 min-w-0 break-words font-semibold text-kumo-strong tabular-nums">{selectedTicket.bookingCode}</dd>
              <dt className="text-kumo-subtle">Người sở hữu</dt>
              <dd className="mb-2 sm:mb-0 min-w-0 break-words font-medium text-kumo-default">{selectedTicket.attendeeName}</dd>
              <dt className="text-kumo-subtle">Hạng vé</dt>
              <dd className="mb-2 sm:mb-0 min-w-0 break-words text-kumo-default">
                {selectedTicket.tierName} <span className="text-kumo-subtle tabular-nums">({selectedTicket.quantity} vé)</span>
              </dd>
              {selectedTicket.selectedSeats && selectedTicket.selectedSeats.length > 0 && (
                <>
                  <dt className="text-kumo-subtle">Vị trí ghế</dt>
                  <dd className="mb-2 sm:mb-0 min-w-0 break-words font-medium text-kumo-default tabular-nums">{selectedTicket.selectedSeats.join(', ')}</dd>
                </>
              )}
            </dl>

            <div className="mt-5 sm:mt-6 grid grid-cols-[1fr_auto] gap-2">
              <button onClick={() => window.print()} className={primaryButtonClass}>
                <Download className="w-4 h-4" />
                <span>In / Tải vé</span>
              </button>
              <button onClick={() => setSelectedTicket(null)} className={secondaryButtonClass}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
