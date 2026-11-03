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
  ExternalLink,
  Armchair,
  AlertCircle,
  X
} from 'lucide-react';
import { SeatMap } from '../components/SeatMap';
import { LogoMark } from '../components/Logo';
import { SeatItem } from '../types';

export const CheckoutPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const initialTierId = searchParams.get('tier');
  const navigate = useNavigate();
  const { getEventById } = useEvents();
  const { user, createBooking } = useAuth();

  const event = eventId ? getEventById(eventId) : undefined;

  const seatsParam = searchParams.get('seats');
  const initialSeatIds = seatsParam ? decodeURIComponent(seatsParam).split(',').filter(Boolean) : [];
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(initialSeatIds);
  const [showSeatMapModal, setShowSeatMapModal] = useState<boolean>(false);
  const [holdTimeLeft, setHoldTimeLeft] = useState<number | null>(initialSeatIds.length > 0 ? 300 : null);

  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [quantity, setQuantity] = useState(initialSeatIds.length > 0 ? initialSeatIds.length : 1);
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

  // Keep quantity in sync with selected seats
  useEffect(() => {
    if (selectedSeatIds.length > 0) {
      setQuantity(selectedSeatIds.length);
      if (holdTimeLeft === null) setHoldTimeLeft(300);
    }
  }, [selectedSeatIds.length]);

  // 5-minute hold timer countdown effect (US-03)
  useEffect(() => {
    if (holdTimeLeft === null) return;
    if (holdTimeLeft <= 0) {
      alert('Đã hết hạn giữ chỗ 5 phút! Vui lòng chọn lại ghế để tiếp tục.');
      navigate(`/event/${event?.id}`);
      return;
    }
    const timer = setInterval(() => {
      setHoldTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [holdTimeLeft, event?.id, navigate]);

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <Navbar />
        <div className="max-w-md mx-auto my-auto text-center py-20 px-4">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-kumo-strong">Không tìm thấy sự kiện</h2>
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-lg bg-kumo-brand px-3.5 font-medium sm:h-9 text-kumo-on-brand transition-colors hover:bg-kumo-brand-hover"
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
      paymentMethod,
      selectedSeats: selectedSeatIds.length > 0 ? selectedSeatIds : undefined
    });

    setIsProcessing(false);
    setConfirmedBooking(booking);
  };

  const panel = 'rounded-xl bg-kumo-base ring ring-kumo-line shadow-xs';
  const sectionTitle =
    'flex items-center gap-2 border-b border-kumo-hairline pb-3 text-lg font-semibold tracking-tight text-kumo-strong';
  const fieldLabel = 'mb-1.5 block text-sm font-medium text-kumo-default';
  const input =
    'h-10 w-full rounded-lg bg-kumo-control px-3 text-lg text-kumo-default ring ring-kumo-line placeholder:text-kumo-placeholder focus:outline-none focus:ring-2 focus:ring-kumo-brand sm:h-9 sm:text-base';
  const option = (active: boolean) =>
    `flex cursor-pointer items-center gap-3 rounded-lg p-3 ring transition-colors ${
      active ? 'bg-kumo-info-tint ring-2 ring-kumo-brand' : 'bg-kumo-base ring-kumo-line hover:bg-kumo-tint'
    }`;
  const stepper =
    'grid size-10 place-items-center rounded-lg bg-kumo-base text-lg font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-50 sm:size-8';
  const isHolding = selectedSeatIds.length > 0 && holdTimeLeft !== null;
  const holdClock =
    holdTimeLeft !== null ? `${Math.floor(holdTimeLeft / 60)}:${String(holdTimeLeft % 60).padStart(2, '0')}` : '';

  const confirmButtonContent = isProcessing ? (
    <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
  ) : (
    <>
      <QrCode className="size-4" />
      <span>Xác nhận &amp; Nhận vé điện tử</span>
    </>
  );
  const confirmButtonClass =
    'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-kumo-brand font-medium text-kumo-on-brand transition-colors hover:bg-kumo-brand-hover disabled:cursor-not-allowed disabled:opacity-50';

  const orderSummary = (
    <dl className="space-y-2.5">
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
        <dt className="text-kumo-subtle">Hạng vé</dt>
        <dd className="text-right font-medium text-kumo-strong">{selectedTier?.name}</dd>
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
        <dt className="text-kumo-subtle">Đơn giá</dt>
        <dd className="text-kumo-default tabular-nums">{formatPrice(ticketPrice, event.currency)}</dd>
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
        <dt className="text-kumo-subtle">Số lượng</dt>
        <dd className="font-medium text-kumo-strong tabular-nums">{quantity} vé</dd>
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
        <dt className="text-kumo-subtle">Phí dịch vụ &amp; Bảo hiểm vé</dt>
        <dd className="text-kumo-default tabular-nums">
          {bookingFee === 0 ? 'Miễn phí' : formatPrice(bookingFee, event.currency)}
        </dd>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-kumo-hairline pt-3">
        <dt className="text-lg font-medium text-kumo-strong">Tổng thanh toán</dt>
        <dd className="text-2xl font-bold tracking-tight text-kumo-strong tabular-nums">
          {formatPrice(totalAmount, event.currency)}
        </dd>
      </div>
    </dl>
  );

  return (
    <div className={`min-h-screen flex flex-col ${confirmedBooking ? '' : 'pb-36 lg:pb-0'}`}>
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Navigation back */}
        <div className="mb-4 sm:mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-2 inline-flex h-10 items-center sm:h-8 gap-1.5 rounded-md px-2 text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default"
          >
            <ArrowLeft className="size-4" />
            <span>Quay lại trang sự kiện</span>
          </button>
        </div>

        {/* 5-minute hold timer banner (US-03) */}
        {isHolding && holdTimeLeft !== null && (
          <div
            className={`mb-6 flex flex-col gap-3 rounded-xl p-4 ring ring-kumo-line sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
              holdTimeLeft < 60 ? 'bg-kumo-danger-tint animate-pulse' : 'bg-kumo-warning-tint'
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <Clock
                className={`mt-0.5 size-5 flex-shrink-0 ${holdTimeLeft < 60 ? 'text-kumo-danger' : 'text-kumo-warning'}`}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2 font-semibold text-kumo-strong">
                  <span className="tabular-nums">Khóa giữ chỗ: {holdClock}</span>
                  <span className="rounded-full bg-kumo-success-tint px-2 py-0.5 text-xs font-medium text-kumo-success ring ring-kumo-line">
                    Độc quyền (US-03)
                  </span>
                </div>
                <div className="break-words text-sm text-kumo-default">
                  Ghế của bạn ({selectedSeatIds.join(', ')}) đang được bảo vệ chống bán trùng (Zero Double-Booking).
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSeatMapModal(true)}
              className="h-10 w-full flex-shrink-0 rounded-lg bg-kumo-base px-3 font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint sm:h-8 sm:w-auto"
            >
              Đổi vị trí ghế
            </button>
          </div>
        )}

        {/* E-Ticket Confirmation Screen if order is finalized */}
        {confirmedBooking ? (
          <div className="space-y-8">
            {/* Success Header */}
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-kumo-success-tint text-kumo-success ring ring-kumo-line">
                <CheckCircle2 className="size-6" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-kumo-strong sm:text-3xl">Đặt vé thành công!</h1>
              <p className="mt-1.5 text-kumo-subtle">
                Vé điện tử chính hãng của bạn đã được xuất bản và lưu trữ trong tài khoản.
              </p>
            </div>

            {/* Digital E-Ticket Card */}
            <div className="relative mx-auto max-w-xl overflow-hidden rounded-xl bg-kumo-base shadow-md ring ring-kumo-line">
              {/* Top Ticket Header */}
              <div className="flex items-center justify-between gap-3 border-b border-kumo-hairline bg-kumo-elevated px-4 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <LogoMark className="size-8" />
                  <div>
                    <div className="font-semibold tracking-tight text-kumo-strong">SortMyScene</div>
                    <div className="text-xs text-kumo-subtle">Official e-ticket</div>
                  </div>
                </div>
                <span className="rounded-full bg-kumo-success-tint px-2 py-0.5 text-xs font-medium text-kumo-success ring ring-kumo-line">
                  Confirmed
                </span>
              </div>

              {/* Event Main Banner in Ticket */}
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <img
                    src={confirmedBooking.imageUrl}
                    alt={confirmedBooking.eventTitle}
                    className="size-20 flex-shrink-0 sm:size-24 rounded-lg object-cover ring ring-kumo-line"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="truncate text-lg font-semibold leading-snug tracking-tight text-kumo-strong">
                      {confirmedBooking.eventTitle}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-kumo-subtle">
                      <Calendar className="size-3.5 flex-shrink-0" />
                      <span>{confirmedBooking.eventDate}</span>
                      <span>{confirmedBooking.eventTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-kumo-subtle">
                      <MapPin className="size-3.5 flex-shrink-0" />
                      <span className="truncate">{confirmedBooking.venue}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="rounded-full bg-kumo-tint px-2 py-0.5 text-xs font-medium text-kumo-default ring ring-kumo-line">
                        {confirmedBooking.tierName}
                      </span>
                      <span className="rounded-full bg-kumo-tint px-2 py-0.5 text-xs font-medium text-kumo-default ring ring-kumo-line tabular-nums">
                        Số lượng: {confirmedBooking.quantity} vé
                      </span>
                    </div>
                    {confirmedBooking.selectedSeats && confirmedBooking.selectedSeats.length > 0 && (
                      <div className="flex items-start gap-1.5 pt-0.5 text-sm font-medium text-kumo-success">
                        <Armchair className="mt-0.5 size-3.5 flex-shrink-0" />
                        <span>Vị trí ghế: {confirmedBooking.selectedSeats.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Perforated Divider Ticket Notch */}
                <div className="relative my-6">
                  <div className="border-b-2 border-dashed border-kumo-hairline" />
                  <div className="absolute -left-7 -top-3 size-6 sm:-left-9 rounded-full bg-kumo-canvas ring ring-kumo-line" />
                  <div className="absolute -right-7 -top-3 size-6 sm:-right-9 rounded-full bg-kumo-canvas ring ring-kumo-line" />
                </div>

                {/* QR Code and Attendee details */}
                <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                  <dl className="space-y-2.5 text-center sm:text-left">
                    <div>
                      <dt className="text-xs text-kumo-subtle">Người nhận vé:</dt>
                      <dd className="font-medium text-kumo-strong">{confirmedBooking.attendeeName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-kumo-subtle">Liên hệ:</dt>
                      <dd className="break-all text-kumo-default">
                        {confirmedBooking.attendeePhone || confirmedBooking.attendeeEmail}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-kumo-subtle">Mã tra cứu vé:</dt>
                      <dd className="text-lg font-semibold tracking-wide text-kumo-strong tabular-nums">
                        {confirmedBooking.bookingCode}
                      </dd>
                    </div>
                  </dl>

                  {/* QR stays on white in both modes so scanners can read it */}
                  <div className="flex flex-col items-center rounded-lg bg-white p-3 ring ring-kumo-line">
                    <img src={confirmedBooking.qrCodeUrl} alt="Check-in QR" className="size-32" />
                    <span className="mt-1 text-xs text-neutral-500">Quét tại cổng soát vé</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col gap-2 border-t border-kumo-hairline bg-kumo-elevated px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
                <Link
                  to="/my-tickets"
                  className="inline-flex h-10 items-center justify-center rounded-lg sm:h-9 bg-kumo-brand px-3.5 font-medium text-kumo-on-brand transition-colors hover:bg-kumo-brand-hover"
                >
                  Xem danh sách vé của tôi
                </Link>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-kumo-base px-3 font-medium sm:h-9 text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint"
                >
                  <Download className="size-4" />
                  <span>In / Tải vé PDF</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Checkout Booking Form */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            {/* Left 2 Cols: Tier selection, Attendee info, Payment options */}
            <div className="space-y-5 lg:col-span-2">
              {/* Event Brief Header */}
              <div className={`${panel} flex items-center gap-4 p-4`}>
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="size-16 flex-shrink-0 rounded-lg object-cover ring ring-kumo-line sm:size-20"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-kumo-subtle">{event.genre}</div>
                  <h2 className="truncate text-lg font-semibold tracking-tight text-kumo-strong">{event.title}</h2>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-kumo-subtle">
                    <span>{event.date}</span>
                    <span>{event.venue}</span>
                  </p>
                </div>
              </div>

              {/* Step 1: Select Tier & Quantity */}
              <section className={`${panel} space-y-4 p-4 sm:p-6`}>
                <h3 className={sectionTitle}>
                  <Ticket className="size-4 text-kumo-subtle" />
                  <span>1. Chọn loại vé &amp; Số lượng</span>
                </h3>

                <div className="space-y-2">
                  {event.ticketTiers.map(tier => (
                    <label
                      key={tier.id}
                      onClick={() => setSelectedTier(tier)}
                      className={`${option(selectedTier?.id === tier.id)} justify-between`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          type="radio"
                          name="ticketTier"
                          checked={selectedTier?.id === tier.id}
                          onChange={() => setSelectedTier(tier)}
                          className="size-4 flex-shrink-0 accent-kumo-brand"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-kumo-strong">{tier.name}</div>
                          <div className="text-sm text-kumo-subtle">{tier.description}</div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right font-semibold text-kumo-strong tabular-nums">
                        {formatPrice(tier.price, event.currency)}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Selected Seats Display or Quantity selector */}
                {selectedSeatIds.length > 0 ? (
                  <div className="space-y-2 border-t border-kumo-hairline pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1.5 font-medium text-kumo-default">
                        <Armchair className="size-4 text-kumo-success" />
                        <span>Vị trí ghế đã chọn ({selectedSeatIds.length} vé):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSeatMapModal(true)}
                        className="-my-2 py-2 text-sm font-medium text-kumo-link underline decoration-kumo-interact hover:decoration-current"
                      >
                        Đổi vị trí ghế
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSeatIds.map(seatId => (
                        <span
                          key={seatId}
                          className="rounded-full bg-kumo-tint px-2 py-0.5 text-xs font-medium text-kumo-default ring ring-kumo-line"
                        >
                          {seatId}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-3">
                    <div className="min-w-0">
                      <span className="block font-medium text-kumo-default">Số lượng vé muốn mua:</span>
                      <button
                        type="button"
                        onClick={() => setShowSeatMapModal(true)}
                        className="inline-flex min-h-10 items-center gap-1 text-left text-sm text-kumo-link underline decoration-kumo-interact hover:decoration-current sm:mt-0.5 sm:min-h-0"
                      >
                        <Armchair className="size-3.5" />
                        <span>Chọn vị trí ghế trực quan</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        aria-label="Giảm số lượng"
                        className={stepper}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-lg font-semibold text-kumo-strong tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(4, quantity + 1))}
                        disabled={quantity >= 4}
                        aria-label="Tăng số lượng"
                        className={stepper}
                        title="Tối đa 4 vé theo quy định chống đầu cơ"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Step 2: Attendee Information */}
              <form id="checkout-form" onSubmit={handleConfirmBooking} className={`${panel} space-y-4 p-4 sm:p-6`}>
                <h3 className={sectionTitle}>
                  <ShieldCheck className="size-4 text-kumo-subtle" />
                  <span>2. Thông tin người nhận vé (Xác thực)</span>
                </h3>

                <div>
                  <label htmlFor="attendee-name" className={fieldLabel}>
                    Họ và tên người nhận vé *
                  </label>
                  <input
                    id="attendee-name"
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={attendeeName}
                    onChange={e => setAttendeeName(e.target.value)}
                    className={input}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="attendee-phone" className={fieldLabel}>
                      Số điện thoại nhận vé *
                    </label>
                    <input
                      id="attendee-phone"
                      type="tel"
                      required
                      placeholder="0987654321"
                      value={attendeePhone}
                      onChange={e => setAttendeePhone(e.target.value)}
                      className={input}
                    />
                  </div>

                  <div>
                    <label htmlFor="attendee-email" className={fieldLabel}>
                      Email nhận mã QR vé *
                    </label>
                    <input
                      id="attendee-email"
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={attendeeEmail}
                      onChange={e => setAttendeeEmail(e.target.value)}
                      className={input}
                    />
                  </div>
                </div>
              </form>

              {/* Step 3: Payment Method Selection */}
              <section className={`${panel} space-y-4 p-4 sm:p-6`}>
                <h3 className={sectionTitle}>
                  <CreditCard className="size-4 text-kumo-subtle" />
                  <span>3. Phương thức thanh toán</span>
                </h3>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { id: 'momo_qr', name: 'Ví MoMo / Quét QR', desc: 'Thanh toán tức thì 24/7' },
                    { id: 'vnpay', name: 'VNPAY / Thẻ ATM Nội Địa', desc: 'Hơn 40 ngân hàng liên kết' },
                    { id: 'visa_master', name: 'Thẻ Quốc Tế (Visa / Mastercard)', desc: 'Bảo mật 3D-Secure' },
                    { id: 'upi_qr', name: 'UPI / NetBanking', desc: 'Chuyển khoản an toàn' }
                  ].map(method => (
                    <label
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={option(paymentMethod === method.id)}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === method.id}
                        onChange={() => setPaymentMethod(method.id)}
                        className="size-4 flex-shrink-0 accent-kumo-brand"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-kumo-strong">{method.name}</div>
                        <div className="text-xs text-kumo-subtle">{method.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* Order breakdown below lg; the total + CTA live in the sticky bottom bar */}
              <section className={`${panel} p-4 sm:p-6 lg:hidden`}>
                <h3 className={`${sectionTitle} mb-4`}>Tóm tắt đơn đặt vé</h3>
                {orderSummary}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-kumo-subtle">
                  <ShieldCheck className="size-3.5 flex-shrink-0 text-kumo-success" />
                  <span>Cam kết hoàn tiền 100% nếu sự kiện bị hủy</span>
                </div>
              </section>
            </div>

            {/* Right Col: Order Summary & Checkout CTA */}
            <aside className="hidden lg:block">
              <div className={`${panel} sticky top-24 p-5`}>
                <h3 className="mb-4 border-b border-kumo-hairline pb-3 text-lg font-semibold tracking-tight text-kumo-strong">
                  Tóm tắt đơn đặt vé
                </h3>

                {orderSummary}

                <button type="submit" form="checkout-form" disabled={isProcessing} className={`mt-5 ${confirmButtonClass}`}>
                  {confirmButtonContent}
                </button>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-kumo-subtle">
                  <ShieldCheck className="size-3.5 text-kumo-success" />
                  <span>Cam kết hoàn tiền 100% nếu sự kiện bị hủy</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Mobile checkout bar: total, hold timer, confirm CTA */}
      {!confirmedBooking && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-kumo-hairline bg-kumo-raised/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="mx-auto max-w-5xl space-y-2.5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-kumo-subtle">Tổng thanh toán</div>
                <div className="truncate text-xl font-semibold tracking-tight text-kumo-strong tabular-nums">
                  {formatPrice(totalAmount, event.currency)}
                </div>
              </div>
              {isHolding && holdTimeLeft !== null && (
                <span
                  className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums ring ring-kumo-line ${
                    holdTimeLeft < 60 ? 'bg-kumo-danger-tint text-kumo-danger' : 'bg-kumo-warning-tint text-kumo-warning'
                  }`}
                  aria-label={`Thời gian giữ chỗ còn lại ${holdClock}`}
                >
                  <Clock className="size-3.5" />
                  {holdClock}
                </span>
              )}
            </div>
            <button type="submit" form="checkout-form" disabled={isProcessing} className={confirmButtonClass}>
              {confirmButtonContent}
            </button>
          </div>
        </div>
      )}

      {/* Modal for Selecting / Changing Seats */}
      {showSeatMapModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chọn vị trí ghế"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6"
        >
          <div className="relative h-full w-full overflow-y-auto overscroll-contain bg-kumo-raised sm:h-auto sm:max-h-[90dvh] sm:max-w-4xl sm:rounded-xl sm:bg-transparent">
            {/* Mobile header with close control */}
            <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-kumo-hairline bg-kumo-raised/95 px-4 backdrop-blur sm:hidden">
              <span className="font-semibold text-kumo-strong">Chọn vị trí ghế</span>
              <button
                type="button"
                onClick={() => setShowSeatMapModal(false)}
                aria-label="Đóng sơ đồ ghế"
                className="grid size-10 place-items-center rounded-lg text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default"
              >
                <X className="size-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowSeatMapModal(false)}
              aria-label="Đóng sơ đồ ghế"
              className="absolute top-4 right-4 z-30 hidden size-8 place-items-center rounded-lg bg-kumo-base text-kumo-subtle ring ring-kumo-line transition-colors hover:bg-kumo-tint hover:text-kumo-default sm:grid"
            >
              <X className="size-4" />
            </button>
            <SeatMap
              layout="modal"
              eventId={event.id}
              currency={event.currency}
              selectedSeatIds={selectedSeatIds}
              onSeatsChange={(seats: SeatItem[]) => {
                setSelectedSeatIds(seats.map(s => s.id));
              }}
              onProceedToCheckout={(seats: SeatItem[]) => {
                setSelectedSeatIds(seats.map(s => s.id));
                setShowSeatMapModal(false);
              }}
              maxSeats={4}
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
