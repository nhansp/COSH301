import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { HoldList } from '../components/HoldList';
import { eventDate } from '../components/events/EventCard';
import { useFeatures } from '../context/FeatureContext';
import { useHolds } from '../hooks/useHolds';
import { Hold, Ticket } from '../types';
import { formatPrice, withServiceFee } from '../services/eventService';
import { apiFetchMyTickets } from '../services/paymentService';

function groupBy<T>(items: T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups.values()];
}

/** The signed-in user's issued tickets; empty while payments are off, because none can exist. */
function useTickets(enabled: boolean) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(enabled ? 'loading' : 'ready');

  const refresh = useCallback(async () => {
    setStatus('loading');
    const data = await apiFetchMyTickets();
    if (data) setTickets(data);
    setStatus(data ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { tickets, status, refresh };
}

export const MyTicketsPage: React.FC = () => {
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const holdEnabled = isEnabled('seat_hold');
  const paymentsEnabled = isEnabled('payments');
  const { holds, now, status: holdStatus, refresh: refreshHolds, release, releasingId, releaseError } = useHolds(holdEnabled);
  const { tickets, status: ticketStatus, refresh: refreshTickets } = useTickets(paymentsEnabled);

  const loading = featuresLoading || (holdEnabled && holdStatus === 'loading') || (paymentsEnabled && ticketStatus === 'loading');
  const failed = (holdEnabled && holdStatus === 'error') || (paymentsEnabled && ticketStatus === 'error');

  let body: React.ReactNode;
  if (loading) {
    body = <div aria-busy="true" className="skeleton mt-10 h-56 w-full rounded-card" />;
  } else if (failed) {
    body = (
      <EmptyState
        className="mt-10"
        role="alert"
        title="Chưa tải được dữ liệu"
        body="Kiểm tra kết nối mạng rồi thử lại."
        action={
          <button
            type="button"
            onClick={() => {
              if (holdEnabled) refreshHolds();
              if (paymentsEnabled) refreshTickets();
            }}
            className="btn btn-ink"
          >
            Thử lại
          </button>
        }
      />
    );
  } else if (tickets.length === 0 && holds.length === 0) {
    body = (
      <EmptyState
        className="mt-10"
        title={holdEnabled || paymentsEnabled ? 'Bạn chưa có vé hay ghế giữ nào' : 'Giữ chỗ đang tạm tắt'}
        body={holdEnabled ? 'Chọn một đêm diễn và bấm vào ghế trên sơ đồ để giữ chỗ.' : undefined}
        action={
          holdEnabled ? (
            <Link to="/" className="btn btn-primary">
              Xem lịch diễn
            </Link>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div className="mt-10 space-y-10">
        {tickets.length > 0 && <TicketSections tickets={tickets} />}
        {holds.length > 0 && (
          <HoldSections holds={holds} now={now} releasingId={releasingId} release={release} releaseError={releaseError} />
        )}
      </div>
    );
  }

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />

      <main className="page-enter mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
        <h1 className="type-display text-display-lg">Vé của tôi</h1>
        <p className="mt-3 text-kumo-subtle">
          {paymentsEnabled
            ? 'Vé đã mua và ghế đang giữ. Ghế giữ 5 phút rồi tự trả lại nếu chưa thanh toán.'
            : 'Ghế được giữ 5 phút rồi tự trả lại. Vé chỉ phát hành khi thanh toán mở.'}
        </p>
        {body}
      </main>

      <Footer />
    </PageShell>
  );
};

const TicketSections: React.FC<{ tickets: Ticket[] }> = ({ tickets }) => (
  <section aria-labelledby="tickets-title" className="space-y-5">
    <h2 id="tickets-title" className="type-display text-title">
      Vé đã mua
    </h2>
    {groupBy(tickets, t => t.eventId).map(group => {
      const event = group[0];
      const when = eventDate(event.startsAt);
      return (
        <article key={event.eventId} className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-7">
          <h3 className="type-display text-xl sm:text-2xl">
            <Link to={`/event/${event.eventId}`} className="underline-offset-[0.14em] hover:underline">
              {event.eventName}
            </Link>
          </h3>
          <p className="mt-1 text-kumo-subtle">
            {when.full}, {when.time} · {event.venueName}
          </p>
          <ul className="mt-2 divide-y divide-kumo-hairline">
            {group.map(ticket => (
              <li key={ticket.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 py-4">
                <div className="min-w-0 flex-1">
                  <p className="type-figure text-2xl text-kumo-strong">{ticket.seatLabel}</p>
                  <p className="text-sm text-kumo-subtle">{ticket.zoneName}</p>
                </div>
                <div className="text-sm text-kumo-subtle">
                  <p>Mã vé {ticket.ticketCode}</p>
                  <p>Đơn {ticket.orderCode}</p>
                </div>
                <span className="type-figure w-32 text-right text-lg text-kumo-strong">{formatPrice(ticket.price)}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-kumo-hairline pt-4 text-kumo-default tabular-nums">
            {group.length} vé · <span className="font-semibold">{formatPrice(group.reduce((sum, t) => sum + t.price, 0))}</span>
            <span className="text-kumo-subtle"> chưa gồm phí dịch vụ</span>
          </p>
        </article>
      );
    })}
  </section>
);

interface HoldSectionsProps {
  holds: Hold[];
  now: number;
  releasingId: string | null;
  release: (hold: Hold) => void;
  releaseError: string | null;
}

const HoldSections: React.FC<HoldSectionsProps> = ({ holds, now, releasingId, release, releaseError }) => (
  <section aria-labelledby="holds-title" className="space-y-5">
    <h2 id="holds-title" className="type-display text-title">
      Ghế đang giữ
    </h2>
    {releaseError && (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {releaseError}
      </p>
    )}
    {groupBy(holds, h => h.eventId).map(group => {
      const event = group[0];
      const when = eventDate(event.startsAt);
      const { total } = withServiceFee(group.reduce((sum, h) => sum + h.price, 0));
      return (
        <article key={event.eventId} className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-7">
          <h3 className="type-display text-xl sm:text-2xl">
            <Link to={`/event/${event.eventId}`} className="underline-offset-[0.14em] hover:underline">
              {event.eventName}
            </Link>
          </h3>
          <p className="mt-1 text-kumo-subtle">
            {when.full}, {when.time} · {event.venueName}
          </p>
          <HoldList holds={group} now={now} releasingId={releasingId} onRelease={release} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-4">
            <span className="text-kumo-default tabular-nums">
              {group.length} ghế · <span className="font-semibold">{formatPrice(total)}</span>
              <span className="text-kumo-subtle"> đã gồm phí dịch vụ</span>
            </span>
            <Link to={`/checkout/${event.eventId}`} className="btn btn-secondary btn-sm">
              Đến thanh toán
            </Link>
          </div>
        </article>
      );
    })}
  </section>
);
