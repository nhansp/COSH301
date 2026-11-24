import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { formatPrice } from '../services/eventService';
import { apiVerifyVNPayReturn, failureMessage, PaymentOutcome } from '../services/paymentService';

type View = { state: 'loading' } | { state: 'error' } | { state: 'invalid' } | { state: 'unknown' } | { state: 'outcome'; outcome: PaymentOutcome };

// VNPay confirms to the server first; the browser can arrive a moment earlier.
const POLL_MS = 2000;
const MAX_POLLS = 8;

/**
 * Where VNPay sends the browser back. It only displays what the server's
 * payment notification recorded; nothing here can mark an order as paid.
 */
export const PaymentReturnPage: React.FC = () => {
  const { search } = useLocation();
  const [view, setView] = useState<View>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async (attempt: number) => {
      const result = await apiVerifyVNPayReturn(search);
      if (cancelled) return;
      if (result.kind === 'ok') {
        setView({ state: 'outcome', outcome: result.outcome });
        if (result.outcome.status === 'processing' && attempt < MAX_POLLS) {
          timer = setTimeout(() => load(attempt + 1), POLL_MS);
        }
      } else {
        setView({ state: result.kind });
      }
    };
    load(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [search]);

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />
      <main className="page-enter mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-20 sm:px-6">
        <h1 className="type-display text-display-sm">Kết quả thanh toán</h1>
        <div className="mt-8">
          <Body view={view} />
        </div>
      </main>
      <Footer />
    </PageShell>
  );
};

const Body: React.FC<{ view: View }> = ({ view }) => {
  switch (view.state) {
    case 'loading':
      return <div aria-busy="true" className="skeleton h-40 w-full rounded-card" />;
    case 'invalid':
      return (
        <EmptyState
          role="alert"
          title="Liên kết không hợp lệ"
          body="Chữ ký của VNPay không khớp, nên không thể xác nhận kết quả. Hãy xem mục Vé của tôi để biết đơn đã được thanh toán chưa."
          action={<Link to="/my-tickets" className="btn btn-primary">Vé của tôi</Link>}
        />
      );
    case 'unknown':
      return (
        <EmptyState
          role="alert"
          title="Không tìm thấy giao dịch"
          action={<Link to="/" className="btn btn-primary">Về trang chủ</Link>}
        />
      );
    case 'error':
      return (
        <EmptyState
          role="alert"
          title="Chưa kiểm tra được kết quả"
          body="Kiểm tra kết nối mạng rồi tải lại trang. Nếu đã bị trừ tiền, vé sẽ xuất hiện ở mục Vé của tôi."
          action={<button type="button" onClick={() => window.location.reload()} className="btn btn-ink">Tải lại</button>}
        />
      );
    case 'outcome':
      return <Outcome outcome={view.outcome} />;
  }
};

const Outcome: React.FC<{ outcome: PaymentOutcome }> = ({ outcome }) => {
  const summary = (
    <p className="text-kumo-subtle">
      Đơn {outcome.orderCode} · {formatPrice(outcome.amount)}
    </p>
  );

  switch (outcome.status) {
    case 'paid':
      return (
        <EmptyState
          role="status"
          title="Thanh toán thành công"
          body={
            <>
              {summary}
              <span className="mt-1 block">Đã phát hành {outcome.ticketCount} vé. Vé nằm ở mục Vé của tôi.</span>
            </>
          }
          action={<Link to="/my-tickets" className="btn btn-primary">Xem vé của tôi</Link>}
        />
      );
    case 'processing':
      return (
        <EmptyState
          role="status"
          title="Đang xác nhận thanh toán"
          body={
            <>
              {summary}
              <span className="mt-1 block">VNPay đã nhận tiền. Hệ thống đang chờ xác nhận để phát hành vé, thường mất vài giây.</span>
            </>
          }
          action={<Link to="/my-tickets" className="btn btn-secondary">Vé của tôi</Link>}
        />
      );
    case 'refund_pending':
      return (
        <EmptyState
          role="alert"
          title="Thanh toán đã nhận nhưng không phát hành được vé"
          body={
            <>
              {summary}
              <span className="mt-1 block">
                Thời gian giữ ghế đã hết hoặc ghế không còn cho bạn. Chúng tôi sẽ hoàn lại toàn bộ số tiền. Giữ mã đơn {outcome.orderCode} để đối chiếu.
              </span>
            </>
          }
          action={<Link to="/" className="btn btn-primary">Về trang chủ</Link>}
        />
      );
    case 'failed':
      return (
        <EmptyState
          role="alert"
          title="Thanh toán chưa thành công"
          body={
            <>
              {summary}
              <span className="mt-1 block">{failureMessage(outcome.responseCode)} Nếu ghế còn được giữ, bạn có thể thử lại.</span>
            </>
          }
          action={<Link to={`/checkout/${outcome.eventId}`} className="btn btn-primary">Thử thanh toán lại</Link>}
        />
      );
  }
};
