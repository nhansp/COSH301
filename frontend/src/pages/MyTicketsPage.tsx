import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { TicketQr } from '../components/TicketQr';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/eventService';
import { Booking, CancelledTicket } from '../types';
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
  Armchair,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  History,
  Archive,
  Receipt
} from 'lucide-react';

const CANCELLATION_REASONS = [
  'Bận lịch trình cá nhân / công việc đột xuất',
  'Mua nhầm thông tin (sự kiện / hạng vé / vị trí ghế)',
  'Giá vé hoặc kế hoạch tài chính thay đổi',
  'Địa điểm hoặc thời gian tổ chức không còn phù hợp',
  'Vấn đề sức khỏe hoặc di chuyển',
  'Lý do khác',
];

export const MyTicketsPage: React.FC = () => {
  const { bookings, cancelledBookings, fetchCancelledTickets, cancelBooking } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'cancelled'>('active');
  const [selectedTicket, setSelectedTicket] = useState<Booking | null>(null);
  const [selectedCancelledTicket, setSelectedCancelledTicket] = useState<CancelledTicket | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<Booking | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [otherReason, setOtherReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelToast, setCancelToast] = useState<string | null>(null);

  useEffect(() => {
    fetchCancelledTickets().catch(() => {});
  }, []);

  const handleOpenCancelSurvey = (booking: Booking) => {
    setTicketToCancel(booking);
    setSelectedReason(CANCELLATION_REASONS[0]);
    setOtherReason('');
  };

  const handleCloseCancelSurvey = () => {
    if (isCancelling) return;
    setTicketToCancel(null);
    setSelectedReason(CANCELLATION_REASONS[0]);
    setOtherReason('');
  };

  const handleConfirmCancel = async () => {
    if (!ticketToCancel) return;
    setIsCancelling(true);
    const code = ticketToCancel.bookingCode;

    let fullReason = selectedReason;
    if (selectedReason === 'Lý do khác') {
      fullReason = otherReason.trim() ? `Lý do khác: ${otherReason.trim()}` : 'Lý do khác';
    } else if (otherReason.trim()) {
      fullReason = `${selectedReason} - Góp ý: ${otherReason.trim()}`;
    }

    await cancelBooking(ticketToCancel.id, fullReason);
    setIsCancelling(false);
    setTicketToCancel(null);
    setSelectedReason(CANCELLATION_REASONS[0]);
    setOtherReason('');
    setCancelToast(`Đã hủy vé ${code} thành công và lưu vào danh sách vé đã hủy!`);
    setTimeout(() => setCancelToast(null), 4000);
  };

  const secondaryButtonClass =
    'flex h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-kumo-base px-3 font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';
  const primaryButtonClass =
    'flex h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-kumo-brand px-3.5 font-medium text-kumo-on-brand transition-colors hover:bg-kumo-brand-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';
  const tabClass = (active: boolean) =>
    `flex h-10 sm:h-9 items-center gap-2 px-3.5 sm:px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
      active
        ? 'bg-kumo-brand text-kumo-on-brand shadow-xs'
        : 'bg-kumo-base text-kumo-subtle ring ring-kumo-line hover:text-kumo-default hover:bg-kumo-tint'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 w-full min-w-0 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Toast Notification */}
        {cancelToast && (
          <div className="mb-6 p-4 rounded-xl bg-kumo-success-tint ring ring-kumo-line text-kumo-success flex items-center gap-3 animate-in fade-in slide-in-from-top-2 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{cancelToast}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
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
            <p className="text-kumo-subtle mt-1 text-sm sm:text-base">
              Quản lý vé đã mua, xuất trình mã QR tại cửa và xem lịch trình concert
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-kumo-tint ring ring-kumo-line text-kumo-default tabular-nums">
              Vé hiệu lực: {bookings.length}
            </span>
            <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-kumo-recessed ring ring-kumo-line text-kumo-subtle tabular-nums">
              Đã hủy: {cancelledBookings.length}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={tabClass(activeTab === 'active')}
          >
            <Ticket className="w-4 h-4" />
            <span>Vé hiệu lực</span>
            <span className="px-1.5 py-0.2 rounded-full text-xs font-semibold tabular-nums opacity-90">
              {bookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancelled')}
            className={tabClass(activeTab === 'cancelled')}
          >
            <History className="w-4 h-4" />
            <span>Vé đã hủy</span>
            <span className="px-1.5 py-0.2 rounded-full text-xs font-semibold tabular-nums opacity-90">
              {cancelledBookings.length}
            </span>
          </button>
        </div>

        {/* Tab: Active Tickets */}
        {activeTab === 'active' && (
          <>
            {bookings.length === 0 ? (
              <div className="py-12 sm:py-16 px-4 sm:px-6 text-center rounded-xl bg-kumo-base ring ring-kumo-line">
                <div className="size-12 rounded-lg bg-kumo-recessed ring ring-kumo-line text-kumo-subtle grid place-items-center mx-auto mb-4">
                  <Ticket className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-kumo-strong mb-1">Bạn chưa có vé sự kiện nào</h3>
                <p className="text-kumo-subtle max-w-sm mx-auto mb-6 text-sm">
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
                                  : 'bg-kumo-tint text-kumo-subtle'
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  confirmed ? 'bg-kumo-success' : 'bg-kumo-subtle'
                                }`}
                              />
                              {confirmed ? 'Đã xác nhận' : 'Đã hủy'}
                            </span>
                          </div>

                          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-kumo-strong mt-1 truncate">
                            {booking.eventTitle}
                          </h2>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="tabular-nums">{booking.eventDate}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="tabular-nums">{booking.eventTime}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{booking.venue}</span>
                            </span>
                          </div>

                          <div className="mt-1.5 text-xs text-kumo-default">
                            <span>Hạng: </span>
                            <strong className="font-medium text-kumo-strong">{booking.tierName}</strong>{' '}
                            <span className="text-kumo-subtle tabular-nums">({booking.quantity} vé)</span>
                            <span className="text-kumo-subtle"> • </span>
                            <span>Tổng: </span>
                            <strong className="font-semibold text-kumo-strong tabular-nums">
                              {formatPrice(booking.totalAmount, booking.currency)}
                            </strong>
                          </div>

                          {booking.selectedSeats && booking.selectedSeats.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-kumo-default">
                              <Armchair className="w-3.5 h-3.5 text-kumo-subtle" />
                              <span>Ghế: </span>
                              <strong className="font-semibold text-kumo-strong tabular-nums">
                                {booking.selectedSeats.join(', ')}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setSelectedTicket(booking)}
                          className={primaryButtonClass}
                        >
                          <Ticket className="w-4 h-4" />
                          <span>Xem mã QR</span>
                        </button>
                        <button
                          onClick={() => handleOpenCancelSurvey(booking)}
                          disabled={booking.status === 'cancelled'}
                          className={secondaryButtonClass}
                        >
                          Hủy vé
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* Tab: Cancelled Tickets */}
        {activeTab === 'cancelled' && (
          <>
            {cancelledBookings.length === 0 ? (
              <div className="py-12 sm:py-16 px-4 sm:px-6 text-center rounded-xl bg-kumo-base ring ring-kumo-line">
                <div className="size-12 rounded-lg bg-kumo-recessed ring ring-kumo-line text-kumo-subtle grid place-items-center mx-auto mb-4">
                  <Archive className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-kumo-strong mb-1">Bạn chưa có vé nào bị hủy</h3>
                <p className="text-kumo-subtle max-w-sm mx-auto text-sm">
                  Tất cả các vé bạn hủy cùng lý do khảo sát và thông tin concert sẽ được lưu trữ an toàn tại đây.
                </p>
              </div>
            ) : (
              <ul className="rounded-xl bg-kumo-base ring ring-kumo-line divide-y divide-kumo-hairline">
                {cancelledBookings.map((ticket, idx) => {
                  const eventImg =
                    ticket.concert?.imageUrl ||
                    ticket.ticketDetails?.imageUrl ||
                    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80';
                  const venueName = ticket.concert?.venue || ticket.ticketDetails?.venue || 'Sân khấu sự kiện';
                  const eventDateStr = ticket.concert?.date || ticket.ticketDetails?.eventDate || '';
                  const eventTimeStr = ticket.concert?.time || ticket.ticketDetails?.eventTime || '';
                  const totalAmt = ticket.ticketDetails?.totalAmount || 0;
                  const tier = ticket.ticketDetails?.tierName || 'Vé concert';
                  const qty = ticket.ticketDetails?.quantity || 1;

                  return (
                    <li
                      key={ticket.id || ticket.bookingCode || idx}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 opacity-90 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                        <img
                          src={eventImg}
                          alt={ticket.eventTitle}
                          className="size-16 sm:size-20 rounded-lg object-cover ring ring-kumo-line grayscale opacity-70 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="max-w-full truncate rounded-md px-1.5 py-0.5 bg-kumo-recessed text-xs font-medium text-kumo-subtle tabular-nums">
                              {ticket.bookingCode}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-kumo-recessed text-kumo-danger">
                              <span className="size-1.5 rounded-full bg-kumo-danger" />
                              Đã hủy vé
                            </span>
                          </div>

                          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-kumo-strong mt-1 truncate">
                            {ticket.eventTitle}
                          </h2>

                          {(eventDateStr || venueName) && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                              {eventDateStr && (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="tabular-nums">{eventDateStr}</span>
                                </span>
                              )}
                              {eventTimeStr && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="tabular-nums">{eventTimeStr}</span>
                                </span>
                              )}
                              {venueName && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate max-w-[200px]">{venueName}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Cancellation Survey & Audit Details */}
                          <div className="mt-2.5 p-3 rounded-lg bg-kumo-recessed ring ring-kumo-line text-xs">
                            <div className="flex items-start gap-1.5 text-kumo-default">
                              <span className="font-medium text-kumo-strong flex-shrink-0">Lý do hủy:</span>
                              <span className="text-kumo-subtle">{ticket.reason}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-kumo-subtle mt-1.5 border-t border-kumo-hairline pt-1.5">
                              <span>
                                Thời gian hủy: <strong className="font-medium text-kumo-default">{new Date(ticket.cancelledAt).toLocaleString('vi-VN')}</strong>
                              </span>
                              {ticket.seats && ticket.seats.length > 0 && (
                                <span>
                                  Ghế đã trả: <strong className="font-semibold text-kumo-strong tabular-nums">{ticket.seats.join(', ')}</strong>
                                </span>
                              )}
                              {totalAmt > 0 && (
                                <span>
                                  Hạng vé: <strong>{tier} ({qty} vé)</strong> • {formatPrice(Number(totalAmt), '₫')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setSelectedCancelledTicket(ticket)}
                          className={secondaryButtonClass}
                        >
                          <Receipt className="w-4 h-4 text-kumo-subtle" />
                          <span>Chi tiết log hủy</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>

      {/* Cancellation Survey & Confirmation Modal */}
      {ticketToCancel && (
        <div className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-ticket-title"
            className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-kumo-raised p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg ring ring-kumo-line sm:relative sm:inset-auto sm:w-full sm:rounded-xl sm:p-6 sm:max-w-lg text-left"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-kumo-recessed ring ring-kumo-line flex items-center justify-center text-kumo-warning flex-shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="cancel-ticket-title" className="text-base sm:text-lg font-semibold tracking-tight text-kumo-strong">
                    Khảo sát lý do hủy vé
                  </h3>
                  <p className="text-xs text-kumo-subtle">
                    Vui lòng chọn lý do để chúng tôi cải thiện chất lượng dịch vụ
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseCancelSurvey}
                disabled={isCancelling}
                aria-label="Đóng"
                className="grid size-8 place-items-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Ticket Details */}
            <div className="mb-4 p-3 rounded-lg bg-kumo-recessed ring ring-kumo-line flex items-center justify-between text-xs">
              <div className="min-w-0 pr-3">
                <p className="font-medium text-kumo-strong truncate">{ticketToCancel.eventTitle}</p>
                <p className="text-kumo-subtle mt-0.5">
                  Mã vé: <span className="font-semibold text-kumo-default tabular-nums">{ticketToCancel.bookingCode}</span> • Hạng: {ticketToCancel.tierName}
                  {ticketToCancel.selectedSeats && ticketToCancel.selectedSeats.length > 0 && (
                    <span> • Ghế: {ticketToCancel.selectedSeats.join(', ')}</span>
                  )}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-kumo-danger/10 text-kumo-danger text-[11px] font-medium flex-shrink-0">
                Sắp hủy
              </span>
            </div>

            {/* Survey Reasons Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-kumo-strong mb-2">
                Tại sao bạn muốn hủy vé này? <span className="text-kumo-danger">*</span>
              </label>
              <div className="space-y-1.5">
                {CANCELLATION_REASONS.map(reason => {
                  const isSelected = selectedReason === reason;
                  return (
                    <label
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg ring text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-kumo-tint ring-kumo-brand text-kumo-strong font-medium'
                          : 'bg-kumo-base ring-kumo-line text-kumo-default hover:bg-kumo-tint'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason}
                        checked={isSelected}
                        onChange={() => setSelectedReason(reason)}
                        className="size-4 text-kumo-brand focus:ring-kumo-brand cursor-pointer"
                      />
                      <span className="flex-1">{reason}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Feedback / Other reason description */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-kumo-strong mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-kumo-subtle" />
                <span>
                  {selectedReason === 'Lý do khác'
                    ? 'Vui lòng ghi rõ lý do của bạn *'
                    : 'Góp ý thêm cho Ban tổ chức (không bắt buộc)'}
                </span>
              </label>
              <textarea
                value={otherReason}
                onChange={e => setOtherReason(e.target.value)}
                placeholder={
                  selectedReason === 'Lý do khác'
                    ? 'Nhập lý do cụ thể bạn muốn hủy vé...'
                    : 'Chia sẻ thêm trải nghiệm hoặc ý kiến của bạn...'
                }
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-kumo-control ring ring-kumo-line text-xs text-kumo-strong placeholder:text-kumo-placeholder focus:outline-none focus:ring-2 focus:ring-kumo-brand resize-none transition-shadow"
              />
            </div>

            {/* Notice */}
            <div className="mb-5 p-3 rounded-lg bg-kumo-recessed ring ring-kumo-line flex items-start gap-2.5 text-xs text-kumo-subtle">
              <AlertTriangle className="w-4 h-4 text-kumo-warning flex-shrink-0 mt-0.5" />
              <span>
                Lưu ý: Sau khi xác nhận, vé sẽ <strong>biến mất hoàn toàn</strong> khỏi danh sách vé của bạn và ghế đã giữ sẽ được giải phóng cho khán giả khác. Thao tác này không thể hoàn tác.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <button
                onClick={handleCloseCancelSurvey}
                disabled={isCancelling}
                className={secondaryButtonClass}
              >
                Không, giữ lại vé
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling || (selectedReason === 'Lý do khác' && !otherReason.trim())}
                className="flex h-11 sm:h-9 items-center justify-center rounded-lg bg-kumo-danger px-3.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isCancelling ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <span>Gửi khảo sát & Hủy vé</span>
                )}
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

      {/* Cancelled Ticket Log Details Modal */}
      {selectedCancelledTicket && (
        <div className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancelled-ticket-title"
            className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-kumo-raised p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg ring ring-kumo-line sm:relative sm:inset-auto sm:w-full sm:rounded-xl sm:p-6 sm:max-w-md text-left"
          >
            <button
              onClick={() => setSelectedCancelledTicket(null)}
              aria-label="Đóng"
              className="absolute top-3 right-3 grid size-11 sm:size-8 place-items-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 bg-kumo-recessed text-kumo-danger text-xs font-medium mb-3">
              <Archive className="w-3.5 h-3.5" />
              <span>Nhật ký hủy vé (Audit Log)</span>
            </div>

            <h3 id="cancelled-ticket-title" className="text-xl font-semibold tracking-tight text-kumo-strong">
              {selectedCancelledTicket.eventTitle}
            </h3>
            <p className="text-kumo-subtle mt-0.5 text-sm">
              {selectedCancelledTicket.concert?.venue || selectedCancelledTicket.ticketDetails?.venue || 'Sân khấu sự kiện'}
              {selectedCancelledTicket.concert?.city ? ` • ${selectedCancelledTicket.concert.city}` : ''}
            </p>

            {/* Concert Metadata */}
            {selectedCancelledTicket.concert && (
              <div className="mt-3 p-3 rounded-lg bg-kumo-recessed ring ring-kumo-line text-xs space-y-1">
                <div className="text-kumo-strong font-medium mb-1 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-kumo-subtle" />
                  <span>Thông tin Concert</span>
                </div>
                {selectedCancelledTicket.concert.venueAddress && (
                  <div className="text-kumo-subtle">
                    Địa chỉ: <span className="text-kumo-default">{selectedCancelledTicket.concert.venueAddress}</span>
                  </div>
                )}
                {selectedCancelledTicket.concert.genre && (
                  <div className="text-kumo-subtle">
                    Thể loại: <span className="text-kumo-default">{selectedCancelledTicket.concert.genre}</span>
                  </div>
                )}
                {(selectedCancelledTicket.concert.date || selectedCancelledTicket.concert.time) && (
                  <div className="text-kumo-subtle">
                    Lịch diễn: <span className="text-kumo-default">{selectedCancelledTicket.concert.date} {selectedCancelledTicket.concert.time}</span>
                  </div>
                )}
              </div>
            )}

            {/* Audit log entry details */}
            <dl className="mt-3 rounded-lg bg-kumo-recessed p-3 text-xs text-left grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:gap-y-2 ring ring-kumo-line">
              <dt className="text-kumo-subtle">Mã đặt chỗ</dt>
              <dd className="min-w-0 break-words font-semibold text-kumo-strong tabular-nums">{selectedCancelledTicket.bookingCode}</dd>
              <dt className="text-kumo-subtle">Thời gian hủy</dt>
              <dd className="min-w-0 break-words text-kumo-default">{new Date(selectedCancelledTicket.cancelledAt).toLocaleString('vi-VN')}</dd>
              <dt className="text-kumo-subtle">Lý do hủy</dt>
              <dd className="min-w-0 break-words text-kumo-default font-medium">{selectedCancelledTicket.reason}</dd>
              {selectedCancelledTicket.seats && selectedCancelledTicket.seats.length > 0 && (
                <>
                  <dt className="text-kumo-subtle">Ghế đã trả</dt>
                  <dd className="min-w-0 break-words font-semibold text-kumo-strong tabular-nums">{selectedCancelledTicket.seats.join(', ')}</dd>
                </>
              )}
              {selectedCancelledTicket.ticketDetails?.tierName && (
                <>
                  <dt className="text-kumo-subtle">Hạng vé</dt>
                  <dd className="min-w-0 break-words text-kumo-default">
                    {selectedCancelledTicket.ticketDetails.tierName} ({selectedCancelledTicket.ticketDetails.quantity || 1} vé)
                  </dd>
                </>
              )}
              {selectedCancelledTicket.ticketDetails?.totalAmount && (
                <>
                  <dt className="text-kumo-subtle">Tổng tiền đã trả</dt>
                  <dd className="min-w-0 break-words font-semibold text-kumo-strong tabular-nums">
                    {formatPrice(Number(selectedCancelledTicket.ticketDetails.totalAmount), '₫')}
                  </dd>
                </>
              )}
            </dl>

            <div className="mt-5">
              <button
                onClick={() => setSelectedCancelledTicket(null)}
                className={`w-full ${secondaryButtonClass}`}
              >
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
