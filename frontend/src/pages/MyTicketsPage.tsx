import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  MapPin,
  Plus,
  QrCode,
  RotateCcw,
  Ticket,
  Trash2,
  X
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { HoldList } from '../components/HoldList';
import { TicketQRCard } from '../components/tickets/TicketQRCard';
import { eventDate } from '../components/events/EventCard';
import { useFeatures } from '../context/FeatureContext';
import { useHolds } from '../hooks/useHolds';
import { Hold } from '../types';
import { invalidateAssistantCache } from '../services/assistantService';
import { formatPrice, serviceFeeOf } from '../services/eventService';
import {
  CancelledTicketItem,
  UserTicket,
  apiCancelTicket,
  apiFetchCancelledTickets,
  apiFetchMyTickets
} from '../services/paymentService';

function groupHoldsByEvent(holds: Hold[]): Hold[][] {
  const groups = new Map<string, Hold[]>();
  for (const hold of holds) groups.set(hold.eventId, [...(groups.get(hold.eventId) ?? []), hold]);
  return [...groups.values()];
}

function groupTicketsByOrder(tickets: UserTicket[]): UserTicket[][] {
  const groups = new Map<string, UserTicket[]>();
  for (const t of tickets) groups.set(t.orderId, [...(groups.get(t.orderId) ?? []), t]);
  return [...groups.values()];
}

type TicketTab = 'tickets' | 'holds' | 'cancelled';

function parseTabParam(raw: string | null): TicketTab | null {
  if (raw === 'tickets' || raw === 'holds' || raw === 'cancelled') return raw;
  return null;
}

function formatCancelledAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const MyTicketsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const holdEnabled = isEnabled('seat_hold');
  const paymentsEnabled = isEnabled('payments');
  const { holds, now, status: holdsStatus, refresh: refreshHolds, release, releasingId, releaseError } =
    useHolds(holdEnabled);

  const tabParam = parseTabParam(searchParams.get('tab'));
  const incomingJustHeld = (location.state as { justHeld?: { count: number; eventName: string } } | null)?.justHeld ?? null;

  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [ticketsStatus, setTicketsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [cancelled, setCancelled] = useState<CancelledTicketItem[]>([]);
  const [cancelledStatus, setCancelledStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeTab, setActiveTab] = useState<TicketTab>(() => tabParam ?? 'tickets');
  const [justHeldBanner, setJustHeldBanner] = useState<{ count: number; eventName: string } | null>(incomingJustHeld);
  const [justCancelledMsg, setJustCancelledMsg] = useState<string | null>(null);
  const userPickedTabRef = useRef(tabParam !== null);
  const [openQrTicketId, setOpenQrTicketId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (tabParam) {
      userPickedTabRef.current = true;
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (incomingJustHeld) {
      setJustHeldBanner(incomingJustHeld);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [incomingJustHeld, location.pathname, location.search, navigate]);

  const selectTab = (tab: TicketTab) => {
    userPickedTabRef.current = true;
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const loadTickets = useCallback(async () => {
    if (!paymentsEnabled) {
      setTickets([]);
      setTicketsStatus('ready');
      return;
    }
    setTicketsStatus('loading');
    const list = await apiFetchMyTickets();
    if (!list) {
      setTicketsStatus('error');
      return;
    }
    setTickets(list);
    setTicketsStatus('ready');
    setOpenQrTicketId(prev => prev ?? list[0]?.id ?? null);
  }, [paymentsEnabled]);

  const loadCancelled = useCallback(async () => {
    if (!paymentsEnabled) {
      setCancelled([]);
      setCancelledStatus('ready');
      return;
    }
    setCancelledStatus('loading');
    const list = await apiFetchCancelledTickets();
    if (!list) {
      setCancelledStatus('error');
      return;
    }
    setCancelled(list);
    setCancelledStatus('ready');
  }, [paymentsEnabled]);

  useEffect(() => {
    if (!featuresLoading) {
      loadTickets();
      loadCancelled();
    }
  }, [featuresLoading, loadTickets, loadCancelled]);

  // Wait for feature flags and data to settle before choosing the initial tab on reload.
  useEffect(() => {
    if (featuresLoading || userPickedTabRef.current) return;
    if (!paymentsEnabled) {
      setActiveTab('holds');
      return;
    }
    if (ticketsStatus === 'ready' && tickets.length > 0) {
      setActiveTab('tickets');
    } else if (ticketsStatus === 'ready' && holdsStatus === 'ready' && tickets.length === 0 && holds.length > 0) {
      setActiveTab('holds');
    }
  }, [featuresLoading, paymentsEnabled, ticketsStatus, holdsStatus, tickets.length, holds.length]);

  const handleConfirmCancelTicket = async (ticket: UserTicket) => {
    setCancelError(null);
    setCancellingId(ticket.id);
    const res = await apiCancelTicket(
      ticket.eventId,
      [ticket.seatId],
      ticket.orderCode,
      cancelReason.trim() || undefined
    );
    setCancellingId(null);
    if (!res.ok) {
      setCancelError('Chưa hủy được vé lúc này. Vui lòng thử lại.');
      return;
    }
    setConfirmCancelId(null);
    setCancelReason('');
    setJustCancelledMsg(`Đã hủy vé ghế ${ticket.seatLabel} (${ticket.eventName}). Ghế đã được mở bán lại.`);
    invalidateAssistantCache();
    await Promise.all([loadTickets(), loadCancelled()]);
  };

  const renderTicketsSection = () => {
    if (ticketsStatus === 'loading') {
      return <div aria-busy="true" className="skeleton mt-6 h-56 w-full rounded-card" />;
    }
    if (ticketsStatus === 'error') {
      return (
        <EmptyState
          className="mt-6"
          role="alert"
          title="Chưa tải được danh sách vé đã mua"
          body="Kiểm tra kết nối mạng rồi thử lại."
          action={
            <button type="button" onClick={loadTickets} className="btn btn-ink">
              Thử lại
            </button>
          }
        />
      );
    }
    if (tickets.length === 0) {
      return (
        <EmptyState
          className="mt-6"
          title="Bạn chưa có vé điện tử nào"
          body={
            holds.length > 0
              ? 'Bạn đang có ghế giữ chỗ — chuyển sang mục Ghế đang giữ để hoàn tất thanh toán và nhận QR.'
              : 'Chọn đêm diễn yêu thích, giữ chỗ và thanh toán để nhận vé điện tử kèm mã QR.'
          }
          action={
            holds.length > 0 ? (
              <button type="button" onClick={() => selectTab('holds')} className="btn btn-primary">
                Thanh toán ghế đang giữ ({holds.length})
              </button>
            ) : (
              <Link to="/" className="btn btn-primary">
                Khám phá lịch diễn
              </Link>
            )
          }
        />
      );
    }

    return (
      <div className="mt-6 space-y-5">
        {cancelError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {cancelError}
          </p>
        )}

        {groupTicketsByOrder(tickets).map(orderGroup => {
          const first = orderGroup[0];
          const when = eventDate(first.eventStartsAt);
          return (
            <section
              key={first.orderId}
              className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-kumo-hairline pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-kumo-success-tint px-2.5 py-0.5 text-xs font-semibold text-kumo-success">
                      Đã thanh toán
                    </span>
                    <span className="font-mono text-xs text-kumo-subtle">
                      Đơn {first.orderCode}
                    </span>
                    {first.paymentMethod && (
                      <span className="rounded-full bg-kumo-recessed px-2 py-0.5 text-[11px] font-medium text-kumo-subtle">
                        {first.paymentMethod}
                      </span>
                    )}
                  </div>
                  <h2 className="type-display mt-2 text-xl sm:text-2xl">
                    <Link to={`/event/${first.eventId}`} className="underline-offset-[0.14em] hover:underline">
                      {first.eventName}
                    </Link>
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-kumo-subtle">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {when.full}, {when.time}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {first.venueName}
                    </span>
                  </p>
                </div>
                <span className="text-sm font-medium text-kumo-subtle tabular-nums">
                  {orderGroup.length} vé
                </span>
              </div>

              <ul className="divide-y divide-kumo-hairline">
                {orderGroup.map(ticket => {
                  const isOpen = openQrTicketId === ticket.id;
                  return (
                    <li key={ticket.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="type-figure text-2xl text-kumo-strong">
                              {ticket.seatLabel}
                            </span>
                            <span className="rounded-full bg-kumo-recessed px-2.5 py-0.5 text-xs text-kumo-default">
                              {ticket.zoneName}
                            </span>
                            <span className="font-mono text-xs text-kumo-subtle">
                              {ticket.ticketCode}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-kumo-subtle tabular-nums">
                            Giá vé: {formatPrice(ticket.price)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenQrTicketId(isOpen ? null : ticket.id)}
                            aria-expanded={isOpen}
                            className={`btn btn-sm ${isOpen ? 'btn-ink' : 'btn-primary'}`}
                          >
                            <QrCode className="size-4" />
                            <span>{isOpen ? 'Ẩn mã QR' : 'Mở QR vào cổng'}</span>
                            <ChevronDown
                              className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelError(null);
                              setCancelReason('');
                              setConfirmCancelId(confirmCancelId === ticket.id ? null : ticket.id);
                            }}
                            disabled={cancellingId === ticket.id}
                            className="btn btn-quiet btn-sm hover:bg-kumo-danger-tint hover:text-kumo-danger"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Hủy vé</span>
                          </button>
                        </div>
                      </div>

                      {confirmCancelId === ticket.id && (
                        <div className="mt-3 rounded-xl bg-kumo-danger-tint/60 p-3.5 ring ring-kumo-danger/30">
                          <p className="text-sm font-medium text-kumo-danger">
                            Xác nhận hủy vé ghế <strong>{ticket.seatLabel}</strong>? Vé sẽ bị vô hiệu hóa và ghế được mở bán lại ngay.
                          </p>
                          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={cancelReason}
                              onChange={e => setCancelReason(e.target.value)}
                              placeholder="Lý do hủy vé (không bắt buộc)..."
                              maxLength={200}
                              className="field h-9 flex-1 text-sm"
                            />
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmCancelTicket(ticket)}
                                disabled={cancellingId === ticket.id}
                                className="btn btn-sm h-9 bg-kumo-danger text-white hover:opacity-90"
                              >
                                {cancellingId === ticket.id ? 'Đang hủy...' : 'Xác nhận hủy'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmCancelId(null);
                                  setCancelReason('');
                                }}
                                disabled={cancellingId === ticket.id}
                                className="btn btn-secondary btn-sm h-9"
                              >
                                Giữ vé
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {isOpen && (
                        <div className="mt-4">
                          <TicketQRCard ticket={ticket} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    );
  };

  const renderHoldsSection = () => {
    if (!holdEnabled) {
      return <EmptyState className="mt-6" title="Giữ chỗ đang tạm tắt" />;
    }
    if (holdsStatus === 'loading') {
      return <div aria-busy="true" className="skeleton mt-6 h-56 w-full rounded-card" />;
    }
    if (holdsStatus === 'error') {
      return (
        <EmptyState
          className="mt-6"
          role="alert"
          title="Chưa tải được ghế đang giữ"
          body="Kiểm tra kết nối mạng rồi thử lại."
          action={
            <button type="button" onClick={refreshHolds} className="btn btn-ink">
              Thử lại
            </button>
          }
        />
      );
    }
    if (holds.length === 0) {
      return (
        <EmptyState
          className="mt-6"
          title="Bạn chưa giữ ghế nào"
          body="Chọn một đêm diễn và bấm vào ghế trên sơ đồ để giữ chỗ trong 5 phút."
          action={
            <Link to="/" className="btn btn-primary">
              Xem lịch diễn
            </Link>
          }
        />
      );
    }

    return (
      <div className="mt-6 space-y-5">
        {releaseError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {releaseError}
          </p>
        )}
        {groupHoldsByEvent(holds).map(group => {
          const event = group[0];
          const when = eventDate(event.startsAt);
          const subtotal = group.reduce((sum, h) => sum + h.price, 0);
          const total = subtotal + serviceFeeOf(subtotal);
          return (
            <section key={event.eventId} className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-7">
              <h2 className="type-display text-xl sm:text-2xl">
                <Link to={`/event/${event.eventId}`} className="underline-offset-[0.14em] hover:underline">
                  {event.eventName}
                </Link>
              </h2>
              <p className="mt-1 text-kumo-subtle">
                {when.full}, {when.time} · {event.venueName}
              </p>
              <HoldList holds={group} now={now} releasingId={releasingId} onRelease={release} />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-4">
                <span className="text-kumo-default tabular-nums">
                  {group.length} ghế ·{' '}
                  <span className="font-semibold">{formatPrice(paymentsEnabled ? total : subtotal)}</span>
                  {paymentsEnabled && <span className="text-xs text-kumo-subtle"> (đã gồm phí 3%)</span>}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/events/${event.eventId}/tickets`}
                    className="btn btn-secondary btn-sm"
                  >
                    <Plus className="size-4" />
                    Chọn thêm ghế
                  </Link>
                  <Link
                    to={`/checkout/${event.eventId}`}
                    className={paymentsEnabled ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  >
                    {paymentsEnabled ? (
                      <>
                        <CreditCard className="size-4" />
                        Tiếp tục thanh toán
                      </>
                    ) : (
                      'Xem chi tiết'
                    )}
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderCancelledSection = () => {
    if (cancelledStatus === 'loading') {
      return <div aria-busy="true" className="skeleton mt-6 h-56 w-full rounded-card" />;
    }
    if (cancelledStatus === 'error') {
      return (
        <EmptyState
          className="mt-6"
          role="alert"
          title="Chưa tải được danh sách vé đã hủy"
          body="Kiểm tra kết nối mạng rồi thử lại."
          action={
            <button type="button" onClick={loadCancelled} className="btn btn-ink">
              Thử lại
            </button>
          }
        />
      );
    }
    if (cancelled.length === 0) {
      return (
        <EmptyState
          className="mt-6"
          title="Chưa có vé nào bị hủy"
          body="Các vé bạn đã hủy sẽ được lưu lại tại đây cùng thời gian hủy, mã ghế và lý do."
          action={
            <button type="button" onClick={() => selectTab('tickets')} className="btn btn-secondary">
              Xem vé đã mua
            </button>
          }
        />
      );
    }

    return (
      <div className="mt-6 space-y-4">
        {cancelled.map(item => {
          const seatList = item.releasedSeats.length > 0 ? item.releasedSeats : item.seats;
          const startsAt = item.concert?.startsAt;
          const when = startsAt ? eventDate(startsAt) : null;
          const venue = item.concert?.venue;
          const city = item.concert?.city;
          const eventTarget = item.concert?.slug || item.eventId;

          return (
            <section
              key={item.id}
              className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-kumo-hairline pb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-kumo-danger-tint px-2.5 py-0.5 text-xs font-semibold text-kumo-danger">
                      <Ban className="size-3" />
                      Đã hủy
                    </span>
                    {item.bookingCode && (
                      <span className="font-mono text-xs text-kumo-subtle">
                        Đơn {item.bookingCode}
                      </span>
                    )}
                    <span className="text-xs text-kumo-subtle tabular-nums">
                      Hủy lúc {formatCancelledAt(item.cancelledAt)}
                    </span>
                  </div>
                  <h2 className="type-display mt-2 text-lg sm:text-xl">
                    {eventTarget ? (
                      <Link to={`/event/${eventTarget}`} className="underline-offset-[0.14em] hover:underline">
                        {item.eventTitle}
                      </Link>
                    ) : (
                      item.eventTitle
                    )}
                  </h2>
                  {(when || venue) && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-kumo-subtle">
                      {when && (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" />
                          {when.full}, {when.time}
                        </span>
                      )}
                      {venue && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5" />
                          {city ? `${venue} · ${city}` : venue}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {item.eventId && (
                  <Link
                    to={`/events/${item.eventId}/tickets`}
                    className="btn btn-secondary btn-sm shrink-0 text-xs"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Đặt lại sự kiện</span>
                  </Link>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-kumo-subtle">Ghế đã hủy:</span>
                  {seatList.map(label => (
                    <span
                      key={label}
                      className="type-figure rounded-lg bg-kumo-recessed px-2.5 py-1 text-sm text-kumo-subtle line-through ring ring-kumo-line"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                {item.reason && (
                  <p className="text-xs text-kumo-subtle">
                    Lý do: <span className="text-kumo-default">{item.reason}</span>
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />

      <main className="page-enter mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
        <h1 className="type-display text-display-lg">
          {paymentsEnabled ? 'Vé của tôi' : 'Ghế đang giữ'}
        </h1>
        <p className="mt-3 text-kumo-subtle">
          {paymentsEnabled
            ? 'Quản lý vé điện tử kèm mã QR cố định, ghế đang giữ chờ thanh toán và lịch sử vé đã hủy.'
            : 'Ghế được giữ 5 phút rồi tự trả lại. Vé chỉ phát hành khi thanh toán mở.'}
        </p>

        {justHeldBanner && (
          <div
            role="status"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-kumo-success-tint px-4 py-3 text-sm text-kumo-success ring ring-kumo-success/30"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>
                Đã giữ <strong>{justHeldBanner.count} ghế</strong> cho sự kiện <strong>{justHeldBanner.eventName}</strong> trong 5 phút. Bạn có thể thanh toán bất cứ lúc nào trước khi hết giờ.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setJustHeldBanner(null)}
              aria-label="Ẩn thông báo"
              className="rounded-lg p-1 text-kumo-success/80 hover:bg-kumo-success/10 hover:text-kumo-success"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {justCancelledMsg && (
          <div
            role="status"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-kumo-recessed px-4 py-3 text-sm text-kumo-default ring ring-kumo-line"
          >
            <div className="flex items-center gap-2.5">
              <Ban className="size-4 shrink-0 text-kumo-danger" />
              <span>{justCancelledMsg}</span>
            </div>
            <div className="flex items-center gap-2">
              {activeTab !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => selectTab('cancelled')}
                  className="btn btn-secondary btn-sm h-8 text-xs"
                >
                  Xem vé đã hủy
                </button>
              )}
              <button
                type="button"
                onClick={() => setJustCancelledMsg(null)}
                aria-label="Ẩn thông báo"
                className="rounded-lg p-1 text-kumo-subtle hover:text-kumo-strong"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        {!featuresLoading && paymentsEnabled && (
          <div
            role="tablist"
            aria-label="Danh mục vé"
            className="mt-7 inline-flex flex-wrap gap-1 rounded-full bg-kumo-recessed p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tickets'}
              onClick={() => selectTab('tickets')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'tickets'
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'text-kumo-subtle hover:text-kumo-strong'
              }`}
            >
              <Ticket className="size-4" />
              <span>Vé đã mua</span>
              <span className="type-figure rounded-full bg-violet/25 px-2 py-0.5 text-xs text-violet-ink">
                {tickets.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'holds'}
              onClick={() => selectTab('holds')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'holds'
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'text-kumo-subtle hover:text-kumo-strong'
              }`}
            >
              <Clock className="size-4" />
              <span>Ghế đang giữ</span>
              {holds.length > 0 && (
                <span className="type-figure rounded-full bg-coral/25 px-2 py-0.5 text-xs text-coral">
                  {holds.length}
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'cancelled'}
              onClick={() => selectTab('cancelled')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'cancelled'
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'text-kumo-subtle hover:text-kumo-strong'
              }`}
            >
              <Ban className="size-4" />
              <span>Vé đã hủy</span>
              {cancelled.length > 0 && (
                <span className="type-figure rounded-full bg-kumo-danger-tint px-2 py-0.5 text-xs text-kumo-danger">
                  {cancelled.length}
                </span>
              )}
            </button>
          </div>
        )}

        {featuresLoading ? (
          <div aria-busy="true" className="skeleton mt-10 h-56 w-full rounded-card" />
        ) : paymentsEnabled && activeTab === 'tickets' ? (
          renderTicketsSection()
        ) : paymentsEnabled && activeTab === 'cancelled' ? (
          renderCancelledSection()
        ) : (
          renderHoldsSection()
        )}
      </main>

      <Footer />
    </PageShell>
  );
};
