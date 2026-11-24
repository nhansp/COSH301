import React, { useState } from 'react';
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
import { formatPrice, SERVICE_FEE_PERCENT, withServiceFee } from '../services/eventService';
import { apiCreateVNPayPayment, CheckoutError } from '../services/paymentService';

const PAY_ERRORS: Record<CheckoutError, string> = {
  no_active_holds: 'Ghế giữ đã hết hạn. Chọn lại ghế trên sơ đồ để tiếp tục.',
  holds_expiring: 'Thời gian giữ ghế còn quá ngắn để thanh toán. Chọn lại ghế để có thêm thời gian.',
  event_not_on_sale: 'Sự kiện này hiện không mở bán.',
  unauthorized: 'Phiên đăng nhập đã hết. Đăng nhập lại rồi thanh toán.',
  unavailable: 'Chưa mở được cổng thanh toán. Thử lại sau giây lát.',
};

// The server prices the order from its own holds; the totals shown here use the same rule.
export const CheckoutPage: React.FC = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const holdEnabled = isEnabled('seat_hold');
  const { holds, now, status, refresh, release, releasingId, releaseError } = useHolds(holdEnabled);

  const eventHolds = holds.filter(h => h.eventId === eventId || h.eventSlug === eventId);
  const first = eventHolds[0];
  const { subtotal, fee, total } = withServiceFee(eventHolds.reduce((sum, h) => sum + h.price, 0));
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const pay = async () => {
    setPayError(null);
    setPaying(true);
    const result = await apiCreateVNPayPayment(first?.eventId ?? eventId);
    if (result.kind === 'ok') {
      window.location.assign(result.checkout.paymentUrl);
      return; // leaving the page: keep the button disabled
    }
    setPaying(false);
    setPayError(PAY_ERRORS[result.error]);
    if (result.error === 'no_active_holds' || result.error === 'holds_expiring') refresh();
  };
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
          <dl className="space-y-1 border-t border-kumo-hairline pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-kumo-subtle">Tạm tính</dt>
              <dd className="tabular-nums text-kumo-default">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-kumo-subtle">Phí dịch vụ ({SERVICE_FEE_PERCENT}%)</dt>
              <dd className="tabular-nums text-kumo-default">{formatPrice(fee)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-kumo-contrast pt-4">
            <span className="font-medium text-kumo-strong">Tổng cộng</span>
            <span className="type-figure text-3xl text-kumo-strong">{formatPrice(total)}</span>
          </div>
        </section>

        {isEnabled('payments') ? (
          <section aria-labelledby="pay-title" className="rounded-card bg-kumo-recessed p-5 sm:p-7">
            <h2 id="pay-title" className="type-display text-title">
              Thanh toán
            </h2>
            <p className="mt-2 text-kumo-default">
              Bạn sẽ chuyển sang cổng VNPay (môi trường thử nghiệm). Ghế được giữ trong 5 phút, hết giờ ghế tự trả lại.
            </p>
            {payError && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {payError}
              </p>
            )}
            <button type="button" onClick={pay} disabled={paying} className="btn btn-primary mt-5 h-12 w-full sm:w-auto">
              {paying ? 'Đang chuyển sang VNPay…' : `Thanh toán ${formatPrice(total)} qua VNPay`}
            </button>
          </section>
        ) : (
          <p className="rounded-card bg-kumo-recessed p-5 text-kumo-default">
            Thanh toán chưa mở ở bản này. Ghế được giữ trong 5 phút.
          </p>
        )}
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
