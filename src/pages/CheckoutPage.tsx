import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useEvents } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/eventService';
import { Booking, TicketTier } from '../types';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  QrCode,
  ShieldCheck,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  Download,
  Share2,
  ExternalLink
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const initialTierId = searchParams.get('tier');
  const navigate = useNavigate();
  const { getEventById } = useEvents();
  const { user, createBooking } = useAuth();

  const event = eventId ? getEventById(eventId) : undefined;

  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [attendeeName, setAttendeeName] = useState(user?.name || '');
  const [attendeePhone, setAttendeePhone] = useState(user?.phone || '');
  const [attendeeEmail, setAttendeeEmail] = useState(user?.email || '');
  const [paymentMethod, setPaymentMethod] = useState('momo_qr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (event && event.ticketTiers.length > 0) {
      const match = event.ticketTiers.find(t => t.id === initialTierId);
      setSelectedTier(match || event.ticketTiers[0]);
    }
  }, [event, initialTierId]);

  if (!event) {
    return (
      <div className="min-h-screen purple-glow-bg flex flex-col justify-between">
        <Navbar />
        <div className="max-w-md mx-auto my-auto text-center py-20 px-4">
          <h2 className="text-2xl font-bold text-white mb-2">Không tìm thấy sự kiện</h2>
          <Link
            to="/"
            className="px-6 py-2.5 rounded-full bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500"
          >
            Quay lại trang chủ
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const ticketPrice = selectedTier?.price || 0;
  const subtotal = ticketPrice * quantity;
  const bookingFee = ticketPrice > 0 ? Math.round(subtotal * 0.03) : 0;
  const totalAmount = subtotal + bookingFee;

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;

    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1200));

    const booking = createBooking({
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      venue: event.venue,
      city: event.city,
      imageUrl: event.imageUrl,
      tierId: selectedTier.id,
      tierName: selectedTier.name,
      quantity,
      totalAmount,
      currency: event.currency,
      attendeeName: attendeeName || user?.name || 'Guest Attendee',
      attendeePhone: attendeePhone || user?.phone || 'N/A',
      attendeeEmail: attendeeEmail || user?.email || 'N/A',
      paymentMethod
    });

    setIsProcessing(false);
    setConfirmedBooking(booking);
  };

  return (
    <div className="min-h-screen purple-glow-bg flex flex-col selection:bg-purple-600 selection:text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation back */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-purple-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại trang sự kiện</span>
          </button>
        </div>

        {/* E-Ticket Confirmation Screen if order is finalized */}
        {confirmedBooking ? (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Success Celebration Header */}
            <div className="text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-950">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Đặt vé thành công!
              </h1>
              <p className="text-xs sm:text-sm text-purple-300/80 mt-1">
                Vé điện tử chính hãng của bạn đã được xuất bản và lưu trữ trong tài khoản.
              </p>
            </div>

            {/* Digital E-Ticket Card */}
            <div className="max-w-xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-b from-[#23123d] to-[#160a26] border-2 border-purple-600/50 shadow-2xl relative">
              {/* Top Ticket Header */}
              <div className="p-6 bg-purple-950/40 border-b border-purple-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                    SMS
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-widest font-mono">
                      SORT MY SCENE
                    </div>
                    <div className="text-[10px] text-purple-300">OFFICIAL E-TICKET</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
                    CONFIRMED
                  </span>
                </div>
              </div>

              {/* Event Main Banner in Ticket */}
              <div className="p-6">
                <div className="flex gap-4 items-start">
                  <img
                    src={confirmedBooking.imageUrl}
                    alt={confirmedBooking.eventTitle}
                    className="w-24 h-24 rounded-2xl object-cover border border-purple-500/40 shadow-md flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white leading-snug truncate">
                      {confirmedBooking.eventTitle}
                    </h2>
                    <div className="text-xs text-purple-300 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>{confirmedBooking.eventDate} • {confirmedBooking.eventTime}</span>
                    </div>
                    <div className="text-xs text-purple-300/80 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-purple-400" />
                      <span className="truncate">{confirmedBooking.venue}</span>
                    </div>
                    <div className="mt-2 inline-block px-2.5 py-0.5 rounded-lg bg-purple-900/60 text-purple-200 text-xs font-semibold">
                      {confirmedBooking.tierName} • Số lượng: {confirmedBooking.quantity} vé
                    </div>
                  </div>
                </div>

                {/* Perforated Divider Ticket Notch */}
                <div className="relative my-6">
                  <div className="border-b-2 border-dashed border-purple-800/60" />
                  <div className="absolute -left-9 -top-3 w-6 h-6 rounded-full bg-[#12091c]" />
                  <div className="absolute -right-9 -top-3 w-6 h-6 rounded-full bg-[#12091c]" />
                </div>

                {/* QR Code and Attendee details */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-xs text-center sm:text-left">
                    <div>
                      <span className="text-purple-400 block text-[11px]">Người nhận vé:</span>
                      <strong className="text-white text-sm">{confirmedBooking.attendeeName}</strong>
                    </div>
                    <div>
                      <span className="text-purple-400 block text-[11px]">Liên hệ:</span>
                      <span className="text-purple-200">{confirmedBooking.attendeePhone || confirmedBooking.attendeeEmail}</span>
                    </div>
                    <div>
                      <span className="text-purple-400 block text-[11px]">Mã tra cứu vé:</span>
                      <strong className="text-pink-400 font-mono text-sm tracking-wider">
                        {confirmedBooking.bookingCode}
                      </strong>
                    </div>
                  </div>

                  <div className="flex flex-col items-center bg-[#130822] p-3 rounded-2xl border border-purple-800/60 shadow-inner">
                    <img
                      src={confirmedBooking.qrCodeUrl}
                      alt="Check-in QR"
                      className="w-32 h-32 rounded-lg"
                    />
                    <span className="text-[10px] text-purple-400 mt-1 font-mono">Quét tại cổng soát vé</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-purple-950/60 border-t border-purple-900/80 flex flex-wrap items-center justify-between gap-3">
                <Link
                  to="/my-tickets"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md"
                >
                  Xem danh sách vé của tôi
                </Link>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>In / Tải vé PDF</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Checkout Booking Form */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Tier selection, Attendee info, Payment options */}
            <div className="lg:col-span-2 space-y-6">
              {/* Event Brief Header */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#1d0e32]/80 border border-purple-800/50 flex items-center gap-4">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-purple-600/40 flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <div className="text-xs text-purple-400 font-semibold">{event.genre}</div>
                  <h2 className="text-base sm:text-lg font-bold text-white truncate">{event.title}</h2>
                  <p className="text-xs text-purple-300/80 mt-0.5">{event.date} • {event.venue}</p>
                </div>
              </div>

              {/* Step 1: Select Tier & Quantity */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#1d0e32]/80 border border-purple-800/50 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base border-b border-purple-900/60 pb-3">
                  <Ticket className="w-4 h-4 text-purple-400" />
                  <span>1. Chọn loại vé &amp; Số lượng</span>
                </div>

                <div className="space-y-2.5">
                  {event.ticketTiers.map(tier => (
                    <label
                      key={tier.id}
                      onClick={() => setSelectedTier(tier)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTier?.id === tier.id
                          ? 'bg-purple-900/40 border-purple-400'
                          : 'bg-[#140a24] border-purple-900/70 hover:border-purple-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="ticketTier"
                          checked={selectedTier?.id === tier.id}
                          onChange={() => setSelectedTier(tier)}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-sm font-bold text-white">{tier.name}</div>
                          <div className="text-xs text-purple-300/70">{tier.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-white">
                          {formatPrice(tier.price, event.currency)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Quantity selector */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-purple-200">
                    Số lượng vé muốn mua:
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg bg-purple-900/70 hover:bg-purple-800 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-base font-bold text-white font-mono">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(10, quantity + 1))}
                      disabled={quantity >= 10}
                      className="w-8 h-8 rounded-lg bg-purple-900/70 hover:bg-purple-800 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Attendee Information */}
              <form id="checkout-form" onSubmit={handleConfirmBooking} className="p-5 sm:p-6 rounded-2xl bg-[#1d0e32]/80 border border-purple-800/50 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base border-b border-purple-900/60 pb-3">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>2. Thông tin người nhận vé (Xác thực)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-purple-200 mb-1">
                    Họ và tên người nhận vé *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={attendeeName}
                    onChange={e => setAttendeeName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#140a24] border border-purple-900/80 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-purple-200 mb-1">
                      Số điện thoại nhận vé *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="0987654321"
                      value={attendeePhone}
                      onChange={e => setAttendeePhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#140a24] border border-purple-900/80 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-purple-200 mb-1">
                      Email nhận mã QR vé *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={attendeeEmail}
                      onChange={e => setAttendeeEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#140a24] border border-purple-900/80 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </form>

              {/* Step 3: Payment Method Selection */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#1d0e32]/80 border border-purple-800/50 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base border-b border-purple-900/60 pb-3">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>3. Phương thức thanh toán</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'momo_qr', name: 'Ví MoMo / Quét QR', desc: 'Thanh toán tức thì 24/7' },
                    { id: 'vnpay', name: 'VNPAY / Thẻ ATM Nội Địa', desc: 'Hơn 40 ngân hàng liên kết' },
                    { id: 'visa_master', name: 'Thẻ Quốc Tế (Visa / Mastercard)', desc: 'Bảo mật 3D-Secure' },
                    { id: 'upi_qr', name: 'UPI / NetBanking', desc: 'Chuyển khoản an toàn' }
                  ].map(method => (
                    <label
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                        paymentMethod === method.id
                          ? 'bg-purple-900/40 border-purple-400'
                          : 'bg-[#140a24] border-purple-900/70 hover:border-purple-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === method.id}
                        onChange={() => setPaymentMethod(method.id)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white">{method.name}</div>
                        <div className="text-[11px] text-purple-300/70">{method.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Order Summary & Checkout CTA */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#1d0e32]/95 border border-purple-700/60 p-5 shadow-xl sticky top-28">
                <h3 className="text-base font-bold text-white border-b border-purple-900/60 pb-3 mb-4">
                  Tóm tắt đơn đặt vé
                </h3>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between text-purple-300/90">
                    <span>Hạng vé</span>
                    <span className="font-semibold text-white">{selectedTier?.name}</span>
                  </div>

                  <div className="flex justify-between text-purple-300/90">
                    <span>Đơn giá</span>
                    <span>{formatPrice(ticketPrice, event.currency)}</span>
                  </div>

                  <div className="flex justify-between text-purple-300/90">
                    <span>Số lượng</span>
                    <span className="font-semibold text-white">{quantity} vé</span>
                  </div>

                  <div className="flex justify-between text-purple-300/90">
                    <span>Phí dịch vụ &amp; Bảo hiểm vé</span>
                    <span>{bookingFee === 0 ? 'Miễn phí' : formatPrice(bookingFee, event.currency)}</span>
                  </div>

                  <div className="pt-3 border-t border-purple-900/60 flex justify-between items-baseline">
                    <span className="font-bold text-white text-base">Tổng thanh toán</span>
                    <span className="font-black text-xl text-pink-400">
                      {formatPrice(totalAmount, event.currency)}
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={isProcessing}
                    className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-purple-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        <span>Xác nhận &amp; Nhận vé điện tử</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 text-center text-[11px] text-purple-400/80 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                  <span>Cam kết hoàn tiền 100% nếu sự kiện bị hủy</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
