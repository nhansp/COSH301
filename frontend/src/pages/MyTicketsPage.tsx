import React from 'react';
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
import { Hold } from '../types';
import { formatPrice } from '../services/eventService';

function groupByEvent(holds: Hold[]): Hold[][] {
  const groups = new Map<string, Hold[]>();
  for (const hold of holds) groups.set(hold.eventId, [...(groups.get(hold.eventId) ?? []), hold]);
  return [...groups.values()];
}

// No ticket is issued in this sprint: the page lists only the seats the server is holding.
export const MyTicketsPage: React.FC = () => {
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const holdEnabled = isEnabled('seat_hold');
  const { holds, now, status, refresh, release, releasingId, releaseError } = useHolds(holdEnabled);

  let body: React.ReactNode;
  if (featuresLoading || (holdEnabled && status === 'loading')) {
    body = <div aria-busy="true" className="skeleton mt-10 h-56 w-full rounded-card" />;
  } else if (!holdEnabled) {
    body = <EmptyState className="mt-10" title="Giữ chỗ đang tạm tắt" />;
  } else if (status === 'error') {
    body = (
      <EmptyState
        className="mt-10"
        role="alert"
        title="Chưa tải được ghế đang giữ"
        body="Kiểm tra kết nối mạng rồi thử lại."
        action={
          <button type="button" onClick={refresh} className="btn btn-ink">
            Thử lại
          </button>
        }
      />
    );
  } else if (holds.length === 0) {
    body = (
      <EmptyState
        className="mt-10"
        title="Bạn chưa giữ ghế nào"
        body="Chọn một đêm diễn và bấm vào ghế trên sơ đồ để giữ chỗ."
        action={
          <Link to="/" className="btn btn-primary">
            Xem lịch diễn
          </Link>
        }
      />
    );
  } else {
    body = (
      <div className="mt-10 space-y-5">
        {releaseError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {releaseError}
          </p>
        )}
        {groupByEvent(holds).map(group => {
          const event = group[0];
          const when = eventDate(event.startsAt);
          const total = group.reduce((sum, h) => sum + h.price, 0);
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
                  {group.length} ghế · <span className="font-semibold">{formatPrice(total)}</span>
                </span>
                <Link to={`/checkout/${event.eventId}`} className="btn btn-secondary btn-sm">
                  Xem chi tiết
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />

      <main className="page-enter mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
        <h1 className="type-display text-display-lg">Ghế đang giữ</h1>
        <p className="mt-3 text-kumo-subtle">Ghế được giữ 5 phút rồi tự trả lại. Vé chỉ phát hành khi thanh toán mở.</p>
        {body}
      </main>

      <Footer />
    </PageShell>
  );
};
