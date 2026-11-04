import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { TicketQr } from '../components/TicketQr';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/eventService';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Download,
  Armchair,
  Calendar,
  MapPin,
  ExternalLink,
  Building2,
  Wallet,
  Ticket
} from 'lucide-react';
import { LogoMark } from '../components/Logo';

export const PaymentPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { getBookingById, confirmBooking, cancelBooking, bookings } = useAuth();

  const [booking, setBooking] = useState(() => (bookingId ? getBookingById(bookingId) : undefined));
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes payment countdown
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(booking?.status === 'confirmed');
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  // Keep booking state in sync if loaded or confirmed
  useEffect(() => {
    if (bookingId) {
      const found = getBookingById(bookingId);
      if (found) {
        setBooking(found);
        if (found.status === 'confirmed') {
          setIsSuccess(true);
        }
      }
    }
  }, [bookingId, bookings]);

  // Payment countdown timer
  useEffect(() => {
    if (isSuccess || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSuccess, timeLeft]);

  // Generate dynamic VietQR payload and SVG
  useEffect(() => {
    if (!booking) return;

    // Standard VietQR transfer string format
    const qrPayload = `https://img.vietqr.io/image/MB-0388999888-compact2.png?amount=${booking.totalAmount}&addInfo=${encodeURIComponent(
      booking.bookingCode
    )}&accountName=CONG%20TY%20CP%20VE%20SORTMYSCENE`;

    // Also generate local SVG QR for 100% offline reliability
    QRCode.toString(
      `00020101021238540010A00000072701240006970422011003889998880208QRIBFTTA5303704540${booking.totalAmount}5802VN62${String(
        booking.bookingCode.length + 4
      ).padStart(2, '0')}08${String(booking.bookingCode.length).padStart(2, '0')}${booking.bookingCode}6304`,
      {
        type: 'svg',
        margin: 1,
        color: { dark: '#047857', light: '#ffffff' },
      }
    )
      .then(svg => {
        setQrSvg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {});
  }, [booking]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmPayment = async () => {
    if (!booking) return;
    setIsVerifying(true);

    // Simulate real-time bank webhook / gateway verification
    await new Promise(r => setTimeout(r, 1400));

    const updated = confirmBooking(booking.id);
    if (updated) {
      setBooking(updated);
      setIsSuccess(true);
    }
    setIsVerifying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!booking) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-kumo-canvas">
        <Navbar />
        <main className="max-w-md mx-auto my-auto text-center py-20 px-4">
          <AlertCircle className="size-12 text-kumo-subtle mx-auto mb-3" />
          <h2 className="text-xl font-bold text-kumo-strong mb-2">Không tìm thấy đơn thanh toán</h2>
          <p className="text-sm text-kumo-subtle mb-6">
            Mã đơn hàng không tồn tại hoặc đã hết thời gian giữ chỗ.
          </p>
          <Link
            to="/"
            className="inline-flex h-10 items-center px-4 rounded-lg bg-kumo-brand text-kumo-on-brand font-medium text-sm"
          >
            Quay lại trang chủ
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const vietQrImageUrl = `https://img.vietqr.io/image/MB-0388999888-compact2.png?amount=${booking.totalAmount}&addInfo=${encodeURIComponent(
    booking.bookingCode
  )}&accountName=CONG%20TY%20CP%20VE%20SORTMYSCENE`;

  return (
    <div className="min-h-screen flex flex-col bg-kumo-canvas text-kumo-default">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Breadcrumbs */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-kumo-hairline">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-kumo-subtle hover:text-kumo-strong transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Quay lại</span>
          </button>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <span className="text-kumo-subtle flex items-center gap-1">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              1. Chọn vé
            </span>
            <span className="text-kumo-subtle">›</span>
            <span className={`flex items-center gap-1 ${isSuccess ? 'text-kumo-subtle' : 'text-emerald-700 dark:text-emerald-300 font-bold'}`}>
              <QrCode className="size-4" />
              2. Thanh toán QR
            </span>
            <span className="text-kumo-subtle">›</span>
            <span className={`flex items-center gap-1 ${isSuccess ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-kumo-subtle'}`}>
              <Ticket className="size-4" />
              3. Nhận vé
            </span>
          </div>
        </div>

        {/* =========================================================================
            STATE 1: PAYMENT SUCCESS (E-TICKET DISPLAY)
           ========================================================================= */}
        {isSuccess ? (
          <div className="space-y-8 animate-fade-in">
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30">
                <CheckCircle2 className="size-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-kumo-strong sm:text-3xl">
                Thanh toán thành công!
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-kumo-subtle">
                Vé điện tử chính hãng của bạn đã được xuất bản và kích hoạt vào tài khoản.
              </p>
            </div>

            {/* Official E-Ticket Card */}
            <div className="relative mx-auto max-w-xl overflow-hidden rounded-2xl bg-kumo-base shadow-lg ring-1 ring-emerald-500/30">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-kumo-hairline bg-kumo-elevated px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <LogoMark className="size-8" />
                  <div>
                    <div className="font-bold tracking-tight text-kumo-strong">SortMyScene</div>
                    <div className="text-xs text-kumo-subtle">Vé điện tử chính hãng (Official E-Ticket)</div>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  ĐÃ XÁC THỰC
                </span>
              </div>

              {/* Event Details */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <img
                    src={booking.imageUrl}
                    alt={booking.eventTitle}
                    className="size-20 sm:size-24 rounded-xl object-cover ring-1 ring-kumo-line flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-kumo-strong leading-tight">
                      {booking.eventTitle}
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-kumo-subtle">
                      <Calendar className="size-3.5 flex-shrink-0 text-emerald-600" />
                      <span>{booking.eventDate} • {booking.eventTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-kumo-subtle">
                      <MapPin className="size-3.5 flex-shrink-0 text-emerald-600" />
                      <span className="truncate">{booking.venue}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-kumo-tint text-xs font-medium text-kumo-strong">
                        {booking.tierName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-kumo-tint text-xs font-medium text-kumo-strong tabular-nums">
                        {booking.quantity} vé
                      </span>
                    </div>
                    {booking.selectedSeats && booking.selectedSeats.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Armchair className="size-3.5" />
                        <span>Vị trí ghế: {booking.selectedSeats.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ticket Notch Divider */}
                <div className="relative my-4">
                  <div className="border-b-2 border-dashed border-kumo-hairline" />
                  <div className="absolute -left-8 -top-3 size-6 rounded-full bg-kumo-canvas ring-1 ring-kumo-line" />
                  <div className="absolute -right-8 -top-3 size-6 rounded-full bg-kumo-canvas ring-1 ring-kumo-line" />
                </div>

                {/* Gate Check-in QR */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
                  <div className="space-y-2 text-center sm:text-left">
                    <div>
                      <span className="text-xs text-kumo-subtle block">Người nhận vé</span>
                      <span className="font-semibold text-kumo-strong">{booking.attendeeName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-kumo-subtle block">Liên hệ</span>
                      <span className="text-sm text-kumo-default">{booking.attendeePhone || booking.attendeeEmail}</span>
                    </div>
                    <div>
                      <span className="text-xs text-kumo-subtle block">Mã tra cứu vé</span>
                      <span className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">
                        {booking.bookingCode}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center p-3 rounded-xl bg-white shadow-xs ring-1 ring-neutral-200">
                    <TicketQr code={booking.bookingCode} className="size-32" />
                    <span className="text-[11px] font-semibold text-neutral-600 mt-1">
                      Mã quét check-in cổng
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-kumo-hairline bg-kumo-elevated p-4 sm:px-6">
                <Link
                  to="/my-tickets"
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950 font-semibold text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <Ticket className="size-4" />
                  <span>Xem trong "Vé của tôi"</span>
                </Link>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-10 px-4 rounded-xl bg-kumo-base ring-1 ring-kumo-line hover:bg-kumo-tint font-medium text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <Download className="size-4" />
                  <span>In / Lưu vé PDF</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
              STATE 2: PAYMENT QR CODE SCREEN (WAITING FOR SCAN & TRANSFER)
             ========================================================================= */
          <div className="space-y-6">
            {/* Countdown Hold Alert */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              timeLeft < 120
                ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 animate-pulse'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
            }`}>
              <div className="flex items-center gap-2.5">
                <Clock className="size-5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-sm block sm:inline mr-2">
                    Thời gian giữ vé thanh toán:
                  </span>
                  <span className="font-mono text-base font-bold tabular-nums">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>
              <span className="text-xs font-medium">
                Vị trí ghế và vé được khóa riêng cho bạn trong thời gian này
              </span>
            </div>

            {/* Main Payment Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: QR Code Display & Scan Instructions */}
              <div className="lg:col-span-6 rounded-2xl bg-kumo-base ring-1 ring-emerald-500/30 p-6 flex flex-col items-center text-center shadow-sm">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-3">
                  <QrCode className="size-3.5" />
                  <span>Quét mã QR để thanh toán</span>
                </div>

                <h3 className="text-lg font-bold text-kumo-strong">
                  Mã QR chuyển khoản tức thì (VietQR)
                </h3>
                <p className="text-xs text-kumo-subtle mt-1 mb-4">
                  Sử dụng ứng dụng Ngân hàng (MB, VCB, Techcombank...) hoặc Ví MoMo để quét
                </p>

                {/* The QR Code Card */}
                <div className="relative p-4 rounded-2xl bg-white shadow-md ring-1 ring-neutral-200 size-64 sm:size-72 flex items-center justify-center">
                  <img
                    src={vietQrImageUrl}
                    alt={`Mã QR thanh toán đơn hàng ${booking.bookingCode}`}
                    className="size-full object-contain"
                    onError={e => {
                      // Fallback to local generated SVG if online service is unreachable
                      if (qrSvg) {
                        (e.currentTarget as HTMLImageElement).src = qrSvg;
                      }
                    }}
                  />
                </div>

                {/* Live verification pulse */}
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <span className="relative flex size-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                  </span>
                  <span>Hệ thống đang tự động lắng nghe giao dịch chuyển khoản...</span>
                </div>
              </div>

              {/* Right Column: Bank Account Details & Confirm Action */}
              <div className="lg:col-span-6 space-y-4">
                {/* Bank Transfer Details Box */}
                <div className="rounded-2xl bg-kumo-base ring-1 ring-emerald-500/20 p-5 space-y-3.5 shadow-sm">
                  <h4 className="text-sm font-bold text-kumo-strong border-b border-kumo-hairline pb-2 flex items-center gap-1.5">
                    <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Thông tin chuyển khoản thủ công</span>
                  </h4>

                  {/* Bank Name */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-kumo-subtle text-xs">Ngân hàng</span>
                    <span className="font-semibold text-kumo-strong text-right">
                      MB Bank (Ngân hàng Quân Đội)
                    </span>
                  </div>

                  {/* Account Number */}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-kumo-hairline">
                    <span className="text-kumo-subtle text-xs">Số tài khoản</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-kumo-strong">
                        0388999888
                      </span>
                      <button
                        onClick={() => copyToClipboard('0388999888', 'account')}
                        className="p-1 rounded-md hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 transition-colors"
                        title="Sao chép số tài khoản"
                      >
                        {copiedField === 'account' ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Account Holder */}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-kumo-hairline">
                    <span className="text-kumo-subtle text-xs">Chủ tài khoản</span>
                    <span className="font-semibold text-kumo-strong text-right text-xs sm:text-sm">
                      CONG TY CO PHAN VE SORTMYSCENE
                    </span>
                  </div>

                  {/* Amount to pay */}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-kumo-hairline bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/25">
                    <div>
                      <span className="text-xs text-kumo-subtle block">Số tiền thanh toán</span>
                      <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {formatPrice(booking.totalAmount, booking.currency)}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(String(booking.totalAmount), 'amount')}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                    >
                      {copiedField === 'amount' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>Sao chép</span>
                    </button>
                  </div>

                  {/* Transfer Memo */}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-kumo-hairline">
                    <div>
                      <span className="text-kumo-subtle text-xs block">Nội dung chuyển khoản (bắt buộc)</span>
                      <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300">
                        {booking.bookingCode}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(booking.bookingCode, 'memo')}
                      className="p-1 rounded-md hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 transition-colors"
                      title="Sao chép nội dung chuyển khoản"
                    >
                      {copiedField === 'memo' ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Event Summary Brief */}
                <div className="rounded-2xl bg-kumo-base ring-1 ring-kumo-line p-4 text-xs space-y-1.5">
                  <div className="font-bold text-kumo-strong text-sm truncate">{booking.eventTitle}</div>
                  <div className="text-kumo-subtle">{booking.eventDate} • {booking.venue}</div>
                  <div className="flex items-center justify-between text-kumo-default pt-1 border-t border-kumo-hairline">
                    <span>Hạng vé: <strong className="text-kumo-strong">{booking.tierName}</strong> ({booking.quantity} vé)</span>
                    {booking.selectedSeats && <span>Ghế: <strong className="text-emerald-600">{booking.selectedSeats.join(', ')}</strong></span>}
                  </div>
                </div>

                {/* Primary Confirmation Action */}
                <div className="pt-2 space-y-2.5">
                  <button
                    onClick={handleConfirmPayment}
                    disabled={isVerifying}
                    className="h-12 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <div className="size-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Đang xác nhận giao dịch...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-5" />
                        <span>Tôi đã chuyển khoản thành công</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (booking) {
                        cancelBooking(booking.id, 'Hủy tại bước thanh toán QR');
                      }
                      navigate(-1);
                    }}
                    className="h-10 w-full rounded-xl text-xs sm:text-sm font-medium text-kumo-subtle hover:text-kumo-strong hover:bg-kumo-tint transition-colors"
                  >
                    Hủy và quay lại chọn vé
                  </button>
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
