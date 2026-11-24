import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  CreditCard,
  MapPin,
  QrCode,
  Ticket,
  Trash2
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
  UserTicket,
  apiCancelTicket,
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

export const MyTicketsPage: React.FC = () => {
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const holdEnabled = isEnabled('seat_hold');
  const paymentsEnabled = isEnabled('payments');
  const { holds, now, status: holdsStatus, refresh: refreshHolds, release, releasingId, releaseError } =
    useHolds(holdEnabled);

  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [ticketsStatus, setTicketsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeTab, setActiveTab] = useState<'tickets' | 'holds'>('tickets');
  const [openQrTicketId, setOpenQrTicketId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!featuresLoading) loadTickets();
  }, [featuresLoading, loadTickets]);

  // Default to held seats tab if the user only has active holds and no paid tickets yet.
  useEffect(() => {
    if (!paymentsEnabled) {
      setActiveTab('holds');
      return;
    }
    if (ticketsStatus === 'ready' && holdsStatus === 'ready' && tickets.length === 0 && holds.length > 0) {
      setActiveTab('holds');
    }
  }, [paymentsEnabled, ticketsStatus, holdsStatus, tickets.length, holds.length]);

  const handleCancelTicket = async (ticket: UserTicket) => {
    if (!window.confirm(`Xác nhận hủy vé ghế ${ticket.seatLabel} (${ticket.eventName})? Ghế sẽ được mở bán lại.`)) {
      return;
    }
    setCancelError(null);
    setCancellingId(ticket.id);
    const res = await apiCancelTicket(ticket.eventId, [ticket.seatId], ticket.orderCode);
    setCancellingId(null);
    if (!res.ok) {
      setCancelError('Chưa hủy được vé lúc này. Vui lòng thử lại.');
      return;
    }
    invalidateAssistantCache();
    await loadTickets();
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
              <button type="button" onClick={() => setActiveTab('holds')} className="btn btn-primary">
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
                            onClick={() => handleCancelTicket(ticket)}
                            disabled={cancellingId === ticket.id}
                            className="btn btn-quiet btn-sm hover:bg-kumo-danger-tint hover:text-kumo-danger"
                          >
                            <Trash2 className="size-3.5" />
                            <span>{cancellingId === ticket.id ? 'Đang hủy...' : 'Hủy vé'}</span>
                          </button>
                        </div>
                      </div>

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
            ? 'Quản lý vé điện tử kèm mã QR cố định và các ghế đang giữ chờ thanh toán.'
            : 'Ghế được giữ 5 phút rồi tự trả lại. Vé chỉ phát hành khi thanh toán mở.'}
        </p>

        {!featuresLoading && paymentsEnabled && (
          <div
            role="tablist"
            aria-label="Danh mục vé"
            className="mt-7 inline-flex gap-1 rounded-full bg-kumo-recessed p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tickets'}
              onClick={() => setActiveTab('tickets')}
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
              onClick={() => setActiveTab('holds')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'holds'
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'text-kumo-subtle hover:text-kumo-strong'
              }`}
            >
              <CreditCard className="size-4" />
              <span>Ghế đang giữ</span>
              {holds.length > 0 && (
                <span className="type-figure rounded-full bg-coral/25 px-2 py-0.5 text-xs text-coral">
                  {holds.length}
                </span>
              )}
            </button>
          </div>
        )}

        {featuresLoading ? (
          <div aria-busy="true" className="skeleton mt-10 h-56 w-full rounded-card" />
        ) : paymentsEnabled && activeTab === 'tickets' ? (
          renderTicketsSection()
        ) : (
          renderHoldsSection()
        )}
      </main>

      <Footer />
    </PageShell>
  );
};
