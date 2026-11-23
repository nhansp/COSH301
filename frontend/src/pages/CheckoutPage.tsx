import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { HoldList } from '../components/HoldList';
import { eventDate } from '../components/events/EventCard';
import { useFeatures } from '../context/FeatureContext';
import { useHolds } from '../hooks/useHolds';
import { formatPrice } from '../services/eventService';

// No payment endpoint exists yet: this page only shows what the server is holding for the user.
export const CheckoutPage: React.FC = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const holdEnabled = isEnabled('seat_hold');
  const { holds, now, status, refresh, release, releasingId, releaseError } = useHolds(holdEnabled);

  const eventHolds = holds.filter(h => h.eventId === eventId || h.eventSlug === eventId);
  const first = eventHolds[0];
  const total = eventHolds.reduce((sum, h) => sum + h.price, 0);
  const seatsUrl = `/events/${first?.eventId ?? eventId}/tickets`;

  let body: React.ReactNode;
  if (featuresLoading || (holdEnabled && status === 'loading')) {
    body = <div aria-busy="true" className="skeleton h-56 w-full rounded-card" />;
  } else if (!holdEnabled) {
    body = <EmptyState title="Giữ chỗ đang tạm tắt" body="Hiện chưa giữ được ghế cho sự kiện này." />;
  } else if (status === 'error') {
    body = (
      <EmptyState
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
  } else if (eventHolds.length === 0) {
    body = (
      <EmptyState
        title="Bạn chưa giữ ghế nào cho sự kiện này"
        body="Ghế giữ quá 5 phút sẽ tự được trả lại. Chọn lại ghế trên sơ đồ để tiếp tục."
        action={
          <Link to={seatsUrl} className="btn btn-primary">
            Chọn ghế
          </Link>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-5">
        <section aria-labelledby="holds-title" className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-7">
          <h2 id="holds-title" className="type-display text-title">
            {eventHolds.length} ghế đang giữ
          </h2>
          {releaseError && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {releaseError}
            </p>
          )}
          <HoldList holds={eventHolds} now={now} releasingId={releasingId} onRelease={release} />
          <div className="flex items-baseline justify-between gap-4 border-t border-kumo-contrast pt-4">
            <span className="font-medium text-kumo-strong">Tổng cộng</span>
            <span className="type-figure text-3xl text-kumo-strong">{formatPrice(total)}</span>
          </div>
        </section>

        <p className="rounded-card bg-kumo-recessed p-5 text-kumo-default">
          {isEnabled('payments')
            ? 'Thanh toán chưa sẵn sàng ở bản này. Ghế được giữ trong 5 phút.'
            : 'Thanh toán sẽ mở ở Sprint 4. Ghế được giữ trong 5 phút.'}
        </p>
        <Link to={seatsUrl} className="btn btn-secondary">
          Chọn thêm hoặc đổi ghế
        </Link>
      </div>
    );
  }

  const when = first ? eventDate(first.startsAt) : null;

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />

      <main className="page-enter mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-20 sm:px-6">
        <Link to={`/event/${first?.eventId ?? eventId}`} className="btn btn-quiet btn-sm -ml-3">
          <ArrowLeft className="size-4" />
          Về trang sự kiện
        </Link>
        <h1 className="type-display mt-3 text-display-sm">Ghế đang giữ</h1>
        {first && when && (
          <p className="mt-2 text-kumo-subtle">
            {first.eventName} · {when.full}, {when.time} · {first.venueName}
          </p>
        )}
        <div className="mt-8">{body}</div>
      </main>

      <Footer />
    </PageShell>
  );
};
