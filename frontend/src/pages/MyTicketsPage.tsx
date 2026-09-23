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
  CheckCircle2
} from 'lucide-react';

export const MyTicketsPage: React.FC = () => {
  const { bookings, cancelBooking, user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<Booking | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<Booking | null>(null);

  return (
    <div className="min-h-screen purple-glow-bg flex flex-col selection:bg-purple-600 selection:text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                    onClick={() => setTicketToCancel(booking)}
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

      {/* Cancel Confirmation Modal */}
      {ticketToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#1d0e32] border border-purple-700/60 p-6 shadow-2xl text-center">
            <h3 className="text-lg font-bold text-white mb-2">Xác nhận hủy đặt vé?</h3>
            <p className="text-xs text-purple-300/80 mb-6">
              Bạn có chắc chắn muốn hủy vé <strong className="text-white">{ticketToCancel.eventTitle}</strong> (Mã: {ticketToCancel.bookingCode})? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTicketToCancel(null)}
                className="flex-1 py-2.5 rounded-xl bg-purple-950 text-purple-200 hover:text-white text-xs font-semibold border border-purple-800 transition-colors"
              >
                Không, giữ lại
              </button>
              <button
                onClick={() => {
                  cancelBooking(ticketToCancel.id);
                  setTicketToCancel(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition-all"
              >
                Xác nhận hủy
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
