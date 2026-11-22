import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Minus, Plus } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { TicketStub } from '../components/TicketStub';
import { HoldTimer } from '../components/tickets/HoldTimer';
import { useEvents } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { readHoldExpiries } from '../hooks/useSeatInventory';
import { apiFetchSeats, formatPrice, serviceFeeOf, ticketLimitOf } from '../services/eventService';
import { ticketLabelOf, zoneKindOf } from '../services/venue';
import { PAYMENT_METHODS } from '../services/paymentMethods';
import { Booking, SeatItem, TicketTier } from '../types';

/** Fallback when the hold was made in another tab and its expiry is unknown here. */
const DEFAULT_HOLD_SECONDS = 300;

export const CheckoutPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const initialTierId = searchParams.get('tier');
  const navigate = useNavigate();
  const { getEventById, loadEventDetail, isLoading } = useEvents();
  const { user, createBooking, ticketsBookedFor } = useAuth();
  const { isEnabled } = useFeatures();

  const event = eventId ? getEventById(eventId) : undefined;
  const needsDetail = !event || event.ticketTiers.length === 0;
  const [isFetchingDetail, setIsFetchingDetail] = useState<boolean>(needsDetail);

  useEffect(() => {
    if (!eventId || !needsDetail) {
      setIsFetchingDetail(false);
      return;
    }
    setIsFetchingDetail(true);
    loadEventDetail(eventId).finally(() => setIsFetchingDetail(false));
  }, [eventId, needsDetail, loadEventDetail]);

  const seatsParam = searchParams.get('seats');
  const selectedSeatIds = useMemo(
    () => (seatsParam ? decodeURIComponent(seatsParam).split(',').filter(Boolean) : []),
    [seatsParam]
  );
  const isSeatBooking = selectedSeatIds.length > 0;

  // The URL only carries seat IDs; labels, zones and live prices come from the seat API.
  const [seatLookup, setSeatLookup] = useState<Record<string, SeatItem>>({});
  const [seatLoadFailed, setSeatLoadFailed] = useState(false);
  const resolvedEventId = event?.id;

  useEffect(() => {
    if (!resolvedEventId || !isSeatBooking) return;
    let cancelled = false;
    setSeatLoadFailed(false);
    apiFetchSeats(resolvedEventId).then(seats => {
      if (cancelled) return;
      if (seats) setSeatLookup(Object.fromEntries(seats.map(s => [s.id, s])));
      else setSeatLoadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedEventId, isSeatBooking]);

  // Count down to the server's expiry for these holds, recorded when they were made.
  const holdDeadline = useMemo(() => {
    if (!resolvedEventId || !isSeatBooking) return null;
    const stored = readHoldExpiries(resolvedEventId);
    const known = selectedSeatIds.map(id => stored[id]).filter((at): at is number => at !== undefined);
    return known.length > 0 ? Math.min(...known) : Date.now() + DEFAULT_HOLD_SECONDS * 1000;
  }, [resolvedEventId, isSeatBooking, selectedSeatIds]);
  const [now, setNow] = useState(() => Date.now());
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const holdSecondsLeft = holdDeadline === null ? null : Math.max(0, Math.ceil((holdDeadline - now) / 1000));

  useEffect(() => {
    if (holdDeadline === null || confirmedBooking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [holdDeadline, confirmedBooking]);

  useEffect(() => {
    if (holdSecondsLeft === 0 && event && !confirmedBooking) {
      navigate(`/events/${event.id}/tickets?expired=1`, { replace: true });
    }
  }, [holdSecondsLeft, event, confirmedBooking, navigate]);

  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [attendeeName, setAttendeeName] = useState(user?.name || '');
  const [attendeePhone, setAttendeePhone] = useState(user?.phone || '');
  const [attendeeEmail, setAttendeeEmail] = useState(user?.email || '');
  const [paymentMethod, setPaymentMethod] = useState<string>('momo_qr');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (event && event.ticketTiers.length > 0) {
      const match = event.ticketTiers.find(t => t.id === initialTierId);
      setSelectedTier(match || event.ticketTiers[0]);
    }
  }, [event, initialTierId]);


  if (isLoading || (isFetchingDetail && needsDetail)) {
    return (
      <PageShell tone="stage">
        <Navbar tone="stage" />
        <main aria-busy="true" className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-10">
          <div className="space-y-5">
            <div className="skeleton h-14 w-64" />
            <div className="skeleton h-40 w-full rounded-card" />
            <div className="skeleton h-56 w-full rounded-card" />
          </div>
          <div className="skeleton h-80 rounded-card" />
        </main>
      </PageShell>
    );
  }

  if (!event) {
    return (
      <PageShell tone="stage">
        <Navbar tone="stage" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
          <EmptyState
            title="Không tìm thấy sự kiện"
            body="Sự kiện có thể đã kết thúc hoặc không còn mở bán."
            action={
              <Link to="/" className="btn btn-primary">
                Xem lịch diễn
              </Link>
            }
          />
        </main>
      </PageShell>
    );
  }

  const kindOfZone = (zoneId: string, zoneName: string) =>
    event.ticketTiers.find(t => t.id === zoneId)?.kind ?? zoneKindOf(zoneName);

  // Seats picked on the map already fix the zone, so they skip tier selection and keep their own price.
  const selectedSeats = selectedSeatIds.map(id => seatLookup[id]).filter((seat): seat is SeatItem => seat !== undefined);
  const seatsReady = selectedSeats.length === selectedSeatIds.length;
  const seatZoneNames = Array.from(new Set(selectedSeats.map(s => s.zoneName)));
  const seatedPicks = selectedSeats.filter(s => kindOfZone(s.zoneId, s.zoneName) === 'seated');
  const standingPicks = Array.from(
    selectedSeats
      .filter(s => kindOfZone(s.zoneId, s.zoneName) === 'standing')
      .reduce((acc, s) => acc.set(s.zoneId, [...(acc.get(s.zoneId) ?? []), s]), new Map<string, SeatItem[]>())
      .values()
  );

  const ticketCount = isSeatBooking ? selectedSeatIds.length : quantity;
  const ticketLimit = ticketLimitOf(event);
  const seatsLeftForUser = Math.max(0, ticketLimit - ticketsBookedFor(event.id));
  const exceedsLimit = ticketCount > seatsLeftForUser;

  const ticketPrice = selectedTier?.price || 0;
  const subtotal = isSeatBooking ? selectedSeats.reduce((sum, seat) => sum + seat.price, 0) : ticketPrice * quantity;
  const bookingFee = serviceFeeOf(subtotal);
  const totalAmount = subtotal + bookingFee;
  const canConfirm =
    !isProcessing && !exceedsLimit && (isSeatBooking ? seatsReady && selectedSeats.length > 0 : !!selectedTier);

  const changeSeatsUrl = `/events/${event.id}/tickets`;

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const tier = isSeatBooking ? { id: selectedSeats[0]?.zoneId, name: seatZoneNames.join(', ') } : selectedTier;
    if (!canConfirm || !tier?.id) return;

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
      tierId: tier.id,
      tierName: tier.name,
      quantity: ticketCount,
      totalAmount,
      currency: event.currency,
      attendeeName: attendeeName || user?.name || 'Khách',
      attendeePhone: attendeePhone || user?.phone || 'N/A',
      attendeeEmail: attendeeEmail || user?.email || 'N/A',
      paymentMethod,
      selectedSeats: isSeatBooking ? selectedSeatIds : undefined,
      seatLabels: isSeatBooking ? selectedSeats.map(s => ticketLabelOf(s, kindOfZone(s.zoneId, s.zoneName))) : undefined
    });

    setIsProcessing(false);
    setConfirmedBooking(booking);
    window.scrollTo({ top: 0 });
  };

  if (confirmedBooking) {
    return (
      <PageShell tone="stage">
        <Navbar tone="stage" />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 sm:py-16">
          <p className="inline-flex h-7 items-center rounded-full bg-kumo-success-tint px-3 text-sm font-semibold text-kumo-success">Đã thanh toán</p>
          <h1 className="type-display mt-4 text-display-md">Vé của bạn đã sẵn sàng</h1>
          <p className="mt-3 mb-10 text-kumo-subtle">Đưa mã QR này cho nhân viên soát vé ở cổng. Vé cũng được lưu trong mục Vé của tôi.</p>
          <TicketStub booking={confirmedBooking} reveal />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/my-tickets" className="btn btn-primary btn-lg">
              Xem vé của tôi
            </Link>
            <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-lg">
              In vé
            </button>
          </div>
        </main>
        <Footer />
      </PageShell>
    );
  }

  const stepTitle = 'type-display mb-5 flex items-baseline gap-3 text-title';
  const stepNumber = 'type-figure text-base text-violet';
  const option = (active: boolean) =>
    `flex cursor-pointer items-center gap-3 rounded-2xl p-4 ring transition-[background-color,box-shadow] ring-inset ${
      active ? 'bg-kumo-tint ring-2 ring-violet' : 'bg-kumo-recessed ring-kumo-line hover:bg-kumo-tint'
    }`;

  const confirmLabel = isProcessing ? 'Đang xử lý…' : `Thanh toán ${formatPrice(totalAmount, event.currency)}`;

  const summary = (
    <dl className="space-y-3">
      {isSeatBooking ? (
        <>
          {seatedPicks.map(seat => (
            <div key={seat.id} className="flex items-baseline justify-between gap-4">
              <dt className="min-w-0 text-kumo-default">
                <span className="type-figure text-lg text-spot">{seat.label}</span> <span className="text-sm text-kumo-subtle">{seat.zoneName}</span>
              </dt>
              <dd className="tabular-nums text-kumo-default">{formatPrice(seat.price, event.currency)}</dd>
            </div>
          ))}
          {standingPicks.map(group => (
            <div key={group[0].zoneId} className="flex items-baseline justify-between gap-4">
              <dt className="min-w-0 text-kumo-default">
                <span className="type-figure text-lg text-spot">{group.length}×</span>{' '}
                <span className="text-sm text-kumo-subtle">{group[0].zoneName}, vé đứng</span>
              </dt>
              <dd className="tabular-nums text-kumo-default">{formatPrice(group.reduce((sum, s) => sum + s.price, 0), event.currency)}</dd>
            </div>
          ))}
          {!seatsReady && !seatLoadFailed && (
            <div aria-hidden="true" className="space-y-2">
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-5 w-2/3" />
            </div>
          )}
        </>
      ) : (
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-kumo-default">
            {quantity} × {selectedTier?.name}
          </dt>
          <dd className="tabular-nums text-kumo-default">{formatPrice(subtotal, event.currency)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-kumo-hairline pt-3 text-sm">
        <dt className="text-kumo-subtle">Tạm tính</dt>
        <dd className="tabular-nums text-kumo-default">{formatPrice(subtotal, event.currency)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <dt className="text-kumo-subtle">Phí dịch vụ (3%)</dt>
        <dd className="tabular-nums text-kumo-default">{formatPrice(bookingFee, event.currency)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-kumo-hairline pt-4">
        <dt className="font-medium text-kumo-strong">Tổng cộng</dt>
        <dd className="type-figure text-3xl text-kumo-strong">{formatPrice(totalAmount, event.currency)}</dd>
      </div>
    </dl>
  );

  return (
    <PageShell tone="stage" className="pb-32 lg:pb-0">
      <Navbar tone="stage" />

      <main className="page-enter mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-10">
        <Link to={isSeatBooking ? changeSeatsUrl : `/event/${event.id}`} className="btn btn-quiet btn-sm -ml-3">
          <ArrowLeft className="size-4" />
          {isSeatBooking ? 'Đổi vị trí' : 'Quay lại sự kiện'}
        </Link>

        <div className="mt-4 mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="type-display text-display-lg">Thanh toán</h1>
            <p className="mt-2 text-kumo-subtle">
              {event.title}, {event.date}, {event.time}
            </p>
          </div>
          {holdSecondsLeft !== null && (
            <div className="rounded-full bg-kumo-base px-4 py-2 ring ring-kumo-line">
              <HoldTimer secondsLeft={holdSecondsLeft} />
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          <div className="space-y-5">
            <section className="panel p-5 sm:p-7" aria-labelledby="step-places">
              <h2 id="step-places" className={stepTitle}>
                <span className={stepNumber}>1</span>
                {isSeatBooking ? 'Vị trí của bạn' : 'Hạng vé và số lượng'}
              </h2>

              {isSeatBooking ? (
                <div className="space-y-3">
                  <ul className="flex flex-wrap gap-2">
                    {seatedPicks.map(seat => (
                      <li key={seat.id} className="flex items-baseline gap-2 rounded-xl bg-spot px-3.5 py-2 text-spot-ink">
                        <span className="type-figure text-xl leading-none">{seat.label}</span>
                        <span className="text-xs">{seat.zoneName}</span>
                      </li>
                    ))}
                    {standingPicks.map(group => (
                      <li key={group[0].zoneId} className="flex items-baseline gap-2 rounded-xl bg-spot px-3.5 py-2 text-spot-ink">
                        <span className="type-figure text-xl leading-none">{group.length}×</span>
                        <span className="text-xs">{group[0].zoneName}, vé đứng</span>
                      </li>
                    ))}
                  </ul>
                  {seatLoadFailed && (
                    <p role="alert" className="flex items-start gap-2 rounded-xl bg-kumo-danger-tint px-3.5 py-2.5 text-sm text-kumo-danger">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>
                        Chưa tải được thông tin vé.{' '}
                        <Link to={changeSeatsUrl} className="underline underline-offset-2">
                          Chọn lại vị trí
                        </Link>
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2" role="radiogroup" aria-label="Hạng vé">
                    {event.ticketTiers.map(tier => (
                      <label key={tier.id} className={`${option(selectedTier?.id === tier.id)} justify-between`}>
                        <span className="flex min-w-0 items-center gap-3">
                          <input
                            type="radio"
                            name="ticketTier"
                            checked={selectedTier?.id === tier.id}
                            onChange={() => setSelectedTier(tier)}
                            className="size-4 shrink-0 accent-violet"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-kumo-strong">{tier.name}</span>
                            <span className="block text-sm text-kumo-subtle">
                              {tier.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'}, còn {tier.available} vé
                            </span>
                          </span>
                        </span>
                        <span className="type-figure shrink-0 text-lg text-kumo-strong">{formatPrice(tier.price, event.currency)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-4">
                    <span className="text-kumo-default">Số lượng</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        aria-label="Bớt một vé"
                        className="btn-icon ring ring-kumo-line disabled:opacity-40"
                      >
                        <Minus className="size-4" />
                      </button>
                      <output className="type-figure w-10 text-center text-3xl text-kumo-strong">{quantity}</output>
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(seatsLeftForUser, quantity + 1))}
                        disabled={quantity >= seatsLeftForUser}
                        aria-label="Thêm một vé"
                        className="btn-icon ring ring-kumo-line disabled:opacity-40"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                  {isEnabled('seat_map_realtime') && (
                    <Link to={changeSeatsUrl} className="link inline-flex text-sm">
                      Muốn chọn vị trí cụ thể? Mở sơ đồ chọn vé
                    </Link>
                  )}
                </div>
              )}

              {exceedsLimit && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-kumo-danger-tint px-3.5 py-2.5 text-sm text-kumo-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {seatsLeftForUser === 0
                    ? `Bạn đã mua đủ ${ticketLimit} vé tối đa cho sự kiện này.`
                    : `Mỗi tài khoản chỉ được mua tối đa ${ticketLimit} vé cho sự kiện này. Bạn còn được mua ${seatsLeftForUser} vé.`}
                </p>
              )}
            </section>

            <form id="checkout-form" onSubmit={handleConfirmBooking} className="panel p-5 sm:p-7" aria-labelledby="step-attendee">
              <h2 id="step-attendee" className={stepTitle}>
                <span className={stepNumber}>2</span>
                Người tham dự
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="attendee-name" className="field-label">
                    Họ và tên
                  </label>
                  <input
                    id="attendee-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={attendeeName}
                    onChange={e => setAttendeeName(e.target.value)}
                    className="field"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="attendee-phone" className="field-label">
                      Số điện thoại
                    </label>
                    <input
                      id="attendee-phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={attendeePhone}
                      onChange={e => setAttendeePhone(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor="attendee-email" className="field-label">
                      Email nhận vé
                    </label>
                    <input
                      id="attendee-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={attendeeEmail}
                      onChange={e => setAttendeeEmail(e.target.value)}
                      className="field"
                    />
                  </div>
                </div>
              </div>
            </form>

            <section className="panel p-5 sm:p-7" aria-labelledby="step-payment">
              <h2 id="step-payment" className={stepTitle}>
                <span className={stepNumber}>3</span>
                Thanh toán
              </h2>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Phương thức thanh toán">
                {PAYMENT_METHODS.map(method => (
                  <label key={method.id} className={option(paymentMethod === method.id)}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                      className="size-4 shrink-0 accent-violet"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-kumo-strong">{method.name}</span>
                      <span className="block text-xs text-kumo-subtle">{method.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-4 text-sm text-kumo-subtle">Bản thử nghiệm: chưa kết nối cổng thanh toán, không có khoản tiền nào bị trừ.</p>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="panel overflow-hidden">
              <div className="flex items-center gap-4 border-b border-kumo-hairline p-5 sm:p-6">
                <img src={event.imageUrl} alt="" referrerPolicy="no-referrer" className="size-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="type-display line-clamp-2 text-lg leading-snug">{event.title}</p>
                  <p className="mt-0.5 truncate text-sm text-kumo-subtle">{event.venue}</p>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <h2 className="mb-4 text-sm text-kumo-subtle">Đơn của bạn</h2>
                {summary}
                <button type="submit" form="checkout-form" disabled={!canConfirm} className="btn btn-primary btn-lg mt-6 hidden w-full lg:flex">
                  {confirmLabel}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div
        style={{ zIndex: 'var(--z-sheet)' }}
        className="fixed inset-x-0 bottom-0 border-t border-kumo-hairline bg-kumo-canvas/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        <div className="mx-auto max-w-6xl space-y-2">
          {holdSecondsLeft !== null && <HoldTimer secondsLeft={holdSecondsLeft} className="text-sm" />}
          <button type="submit" form="checkout-form" disabled={!canConfirm} className="btn btn-primary btn-lg w-full">
            {confirmLabel}
          </button>
        </div>
      </div>

      <Footer />
    </PageShell>
  );
};
