import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
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
  Armchair,
  HelpCircle,
  AlertTriangle,
  MessageSquare
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
  const { bookings, cancelBooking, user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<Booking | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<Booking | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [otherReason, setOtherReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelToast, setCancelToast] = useState<string | null>(null);

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
    setCancelToast(`Đã hủy vé ${code} thành công và ghi nhận khảo sát vào hệ thống!`);
    setTimeout(() => setCancelToast(null), 4000);
  };

  return (
    <div className="min-h-screen purple-glow-bg flex flex-col selection:bg-purple-600 selection:text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast Notification */}
        {cancelToast && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 text-emerald-200 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{cancelToast}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-purple-300 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Khám phá thêm sự kiện</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
              <Ticket className="w-7 h-7 text-purple-400" />
              <span>Vé sự kiện của tôi</span>
            </h1>
            <p className="text-xs sm:text-sm text-purple-300/80 mt-1">
              Quản lý vé đã mua, xuất trình mã QR tại cửa và xem lịch trình concert
            </p>
          </div>

          <div className="hidden sm:block text-right">
            <span className="px-3 py-1 rounded-full bg-purple-950/70 border border-purple-700/60 text-xs font-semibold text-purple-200">
              Tổng số vé: {bookings.length}
            </span>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="py-20 text-center rounded-3xl bg-[#1d0e32]/60 border border-purple-900/50 p-8">
            <div className="w-16 h-16 rounded-full bg-purple-900/40 text-purple-400 flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Bạn chưa có vé sự kiện nào</h3>
            <p className="text-xs sm:text-sm text-purple-300/70 max-w-sm mx-auto mb-6">
              Khám phá danh sách concert, EDM festival và các đêm nhạc acoustic đang mở bán vé ngay hôm nay!
            </p>
            <Link
              to="/"
              className="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all inline-block"
            >
              Mua vé concert ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(booking => (
              <div
                key={booking.id}
                className="rounded-2xl bg-[#1d0e32]/90 border border-purple-800/50 p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:border-purple-600/60 transition-all"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <img
                    src={booking.imageUrl}
                    alt={booking.eventTitle}
                    className="w-20 h-20 rounded-xl object-cover border border-purple-600/40 flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-purple-900/70 text-purple-300 text-[10px] font-mono font-bold">
                        {booking.bookingCode}
                      </span>
                      <span className={`text-[11px] font-bold ${
                        booking.status === 'confirmed' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {booking.status === 'confirmed' ? '• ĐÃ XÁC NHẬN' : '• ĐÃ HỦY'}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white mt-1 truncate">
                      {booking.eventTitle}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-purple-300/80 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        {booking.eventDate} • {booking.eventTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-purple-400" />
                        <span className="truncate max-w-[200px]">{booking.venue}</span>
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-purple-200 mt-1.5">
                      Hạng vé: <span className="text-pink-400">{booking.tierName}</span> ({booking.quantity} vé) • Tổng: {formatPrice(booking.totalAmount, booking.currency)}
                    </div>
                    {booking.selectedSeats && booking.selectedSeats.length > 0 && (
                      <div className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1.5">
                        <Armchair className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Vị trí ghế: <strong className="font-mono text-emerald-300">{booking.selectedSeats.join(', ')}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-purple-900/60">
                  <button
                    onClick={() => setSelectedTicket(booking)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Xem mã QR vé</span>
                  </button>

                  <button
                    onClick={() => handleOpenCancelSurvey(booking)}
                    disabled={booking.status === 'cancelled'}
                    className="px-3 py-2 rounded-xl bg-purple-950/60 hover:bg-red-950/40 border border-purple-900/60 hover:border-red-800/60 text-xs text-purple-300 hover:text-red-300 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Hủy vé
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cancellation Survey & Confirmation Modal */}
      {ticketToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#210f3b] to-[#140826] border border-purple-600/50 p-6 shadow-2xl text-left max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Khảo sát lý do hủy vé</h3>
                  <p className="text-xs text-purple-300">Vui lòng chọn lý do để chúng tôi cải thiện chất lượng dịch vụ</p>
                </div>
              </div>
              <button
                onClick={handleCloseCancelSurvey}
                disabled={isCancelling}
                className="text-purple-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Ticket Details */}
            <div className="mb-4 p-3 rounded-2xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-between text-xs">
              <div className="min-w-0 pr-3">
                <p className="text-white font-semibold truncate">{ticketToCancel.eventTitle}</p>
                <p className="text-purple-300/80 mt-0.5">
                  Mã vé: <span className="text-pink-400 font-mono font-bold">{ticketToCancel.bookingCode}</span> • Hạng: {ticketToCancel.tierName}
                  {ticketToCancel.selectedSeats && ticketToCancel.selectedSeats.length > 0 && (
                    <span> • Ghế: {ticketToCancel.selectedSeats.join(', ')}</span>
                  )}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-semibold flex-shrink-0">
                Sắp hủy
              </span>
            </div>

            {/* Survey Reasons Selection */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-purple-200 mb-2">
                Tại sao bạn muốn hủy vé này? <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2">
                {CANCELLATION_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <label
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-400 text-white font-medium shadow-sm'
                          : 'bg-purple-950/40 border-purple-900/50 text-purple-300 hover:border-purple-700/60 hover:bg-purple-900/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason}
                        checked={isSelected}
                        onChange={() => setSelectedReason(reason)}
                        className="text-purple-600 focus:ring-purple-500 h-4 w-4 border-purple-700 bg-purple-900 cursor-pointer"
                      />
                      <span className="flex-1">{reason}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Feedback / Other reason description */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-purple-200 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {selectedReason === 'Lý do khác'
                    ? 'Vui lòng ghi rõ lý do của bạn *'
                    : 'Góp ý thêm cho Ban tổ chức (không bắt buộc)'}
                </span>
              </label>
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder={
                  selectedReason === 'Lý do khác'
                    ? 'Nhập lý do cụ thể bạn muốn hủy vé...'
                    : 'Chia sẻ thêm trải nghiệm hoặc ý kiến của bạn...'
                }
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-purple-950/70 border border-purple-800/60 text-xs text-white placeholder-purple-400/60 focus:outline-none focus:border-purple-400 resize-none transition-colors"
              />
            </div>

            {/* Notice */}
            <div className="mb-5 p-3 rounded-xl bg-red-950/30 border border-red-500/30 flex items-start gap-2.5 text-[11px] text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>
                Lưu ý: Sau khi xác nhận, vé sẽ <strong>biến mất hoàn toàn</strong> khỏi danh sách vé của bạn và ghế đã giữ sẽ được giải phóng cho khán giả khác. Thao tác này không thể hoàn tác.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCloseCancelSurvey}
                disabled={isCancelling}
                className="flex-1 py-2.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-200 text-xs font-semibold border border-purple-800/80 transition-colors cursor-pointer disabled:opacity-50"
              >
                Không, giữ lại vé
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling || (selectedReason === 'Lý do khác' && !otherReason.trim())}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#23123d] to-[#160a26] border-2 border-purple-500/60 p-6 shadow-2xl text-center">
            <button
              onClick={() => setSelectedTicket(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-purple-950 text-purple-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>VÉ CHÍNH HÃNG HỢP LỆ</span>
            </div>

            <h3 className="text-lg font-black text-white">{selectedTicket.eventTitle}</h3>
            <p className="text-xs text-purple-300 mt-0.5">{selectedTicket.venue}</p>
            <p className="text-xs text-purple-400 mt-0.5">{selectedTicket.eventDate} • {selectedTicket.eventTime}</p>

            {/* QR Code */}
            <div className="my-5 p-3 rounded-2xl bg-white w-48 h-48 mx-auto shadow-xl flex items-center justify-center">
              <img
                src={selectedTicket.qrCodeUrl}
                alt="Ticket QR"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-xs space-y-1 text-purple-200">
              <div>Mã vé: <strong className="font-mono text-pink-400 text-sm">{selectedTicket.bookingCode}</strong></div>
              <div>Người sở hữu: <strong className="text-white">{selectedTicket.attendeeName}</strong></div>
              <div>Hạng vé: <strong>{selectedTicket.tierName}</strong> ({selectedTicket.quantity} vé)</div>
              {selectedTicket.selectedSeats && selectedTicket.selectedSeats.length > 0 && (
                <div>
                  Vị trí ghế: <strong className="text-emerald-400 font-mono">{selectedTicket.selectedSeats.join(', ')}</strong>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>In / Tải vé</span>
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="py-2.5 px-4 rounded-xl bg-purple-950 text-purple-300 hover:text-white font-semibold text-xs border border-purple-800 transition-colors"
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
