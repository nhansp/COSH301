import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { ImageCredit } from '../components/ImageCredit';
import { eventDate } from '../components/events/EventCard';
import { formatPrice } from '../services/eventService';
import { apiFetchMyTickets, apiVerifyVNPayReturn, failureMessage, PaymentOutcome } from '../services/paymentService';
import { Ticket } from '../types';

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
      return <Paid outcome={outcome} />;
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

const Paid: React.FC<{ outcome: PaymentOutcome }> = ({ outcome }) => {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetchMyTickets().then(all => {
      if (!cancelled) setTickets(all ? all.filter(t => t.orderCode === outcome.orderCode) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [outcome.orderCode]);

  const event = tickets?.[0];
  const when = event ? eventDate(event.startsAt) : null;

  return (
    <div role="status" className="border-y border-kumo-hairline py-10">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-kumo-success-tint text-kumo-success">
          <CircleCheck aria-hidden="true" className="size-8" strokeWidth={2.25} />
        </span>
        <div>
          <p className="type-display text-title">Thanh toán thành công</p>
          <p className="text-kumo-subtle tabular-nums">
            Đơn {outcome.orderCode} · {formatPrice(outcome.amount)} đã gồm phí dịch vụ
          </p>
        </div>
      </div>

      {tickets === null ? (
        <div aria-busy="true" className="skeleton mt-8 h-40 w-full rounded-card" />
      ) : event && when ? (
        <article className="mt-8 overflow-hidden rounded-card bg-kumo-base ring ring-kumo-line">
          {event.imageUrl && (
            <Link to={`/event/${event.eventId}`} className="block aspect-[16/7] overflow-hidden bg-kumo-recessed">
              <img
                src={event.imageUrl}
                alt={event.eventName}
                referrerPolicy="no-referrer"
                className="size-full object-cover object-[center_30%]"
              />
            </Link>
          )}
          <div className="p-5 sm:p-7">
            <h2 className="type-display text-xl sm:text-2xl">
              <Link to={`/event/${event.eventId}`} className="underline-offset-[0.14em] hover:underline">
                {event.eventName}
              </Link>
            </h2>
            <p className="mt-1 text-kumo-subtle">
              {when.full}, {when.time} · {event.venueName}
            </p>
            <ul className="mt-2 divide-y divide-kumo-hairline">
              {tickets.map(ticket => (
                <li key={ticket.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="type-figure text-2xl text-kumo-strong">{ticket.seatLabel}</p>
                    <p className="text-sm text-kumo-subtle">{ticket.zoneName}</p>
                  </div>
                  <p className="text-sm text-kumo-subtle">Mã vé {ticket.ticketCode}</p>
                  <span className="type-figure w-32 text-right text-lg text-kumo-strong">{formatPrice(ticket.price)}</span>
                </li>
              ))}
            </ul>
            <ImageCredit credit={event.imageCredit} className="mt-3 text-kumo-subtle" />
          </div>
        </article>
      ) : (
        <p className="mt-6 text-kumo-subtle">Đã phát hành {outcome.ticketCount} vé. Vé nằm ở mục Vé của tôi.</p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/my-tickets" className="btn btn-primary">
          Xem vé của tôi
        </Link>
        <Link to="/" className="btn btn-secondary">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
};
