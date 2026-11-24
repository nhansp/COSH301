import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  Lock,
  QrCode,
  ShieldCheck,
  Smartphone,
  Ticket,
  XCircle
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { HoldList } from '../components/HoldList';
import { TicketQRCard } from '../components/tickets/TicketQRCard';
import { eventDate } from '../components/events/EventCard';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { useHolds } from '../hooks/useHolds';
import { Hold } from '../types';
import { invalidateAssistantCache } from '../services/assistantService';
import { formatPrice, SERVICE_FEE_RATE, serviceFeeOf } from '../services/eventService';
import {
  OrganizerTestCart,
  clearOrganizerTestCart,
  loadOrganizerTestCart,
  saveOrganizerTestCart,
  testCartToHolds
} from '../services/organizerTestCart';
import {
  OrderSummary,
  PaymentProvider,
  PaymentSession,
  UserTicket,
  apiCreateOrder,
  apiInitiatePayment,
  apiSubmitPaymentIPN,
  paymentErrorMessage
} from '../services/paymentService';

const PROVIDERS: {
  id: PaymentProvider;
  name: string;
  subtitle: string;
  accent: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'MOMO',
    name: 'Ví MoMo',
    subtitle: 'Quét mã hoặc xác nhận nhanh qua ví điện tử MoMo',
    accent: 'text-[#d82d8b]',
    Icon: Smartphone
  },
  {
    id: 'VNPAY',
    name: 'VNPAY-QR',
    subtitle: 'Ứng dụng ngân hàng nội địa / thẻ ATM qua cổng VNPAY',
    accent: 'text-[#4c8bf5]',
    Icon: QrCode
  },
  {
    id: 'VIETQR',
    name: 'Chuyển khoản VietQR',
    subtitle: 'Chuyển khoản nhanh 24/7 Napas VietQR đối soát tự động',
    accent: 'text-kumo-success',
    Icon: CreditCard
  }
];

function randomCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export const CheckoutPage: React.FC = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
  const holdEnabled = isEnabled('seat_hold');
  const paymentsEnabled = isEnabled('payments');

  // Organizers never call /api/holds; their test seats live purely in sessionStorage.
  const { holds, now, status, refresh, release, releasingId, releaseError } = useHolds(
    holdEnabled && !isOrganizer
  );

  const [testCart, setTestCart] = useState<OrganizerTestCart | null>(() =>
    isOrganizer ? loadOrganizerTestCart(eventId) : null
  );
  const [testNow, setTestNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOrganizer) {
      setTestCart(null);
      return;
    }
    setTestCart(loadOrganizerTestCart(eventId));
  }, [isOrganizer, eventId]);

  useEffect(() => {
    if (!isOrganizer || !testCart || testCart.seats.length === 0) return;
    const timer = window.setInterval(() => setTestNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOrganizer, testCart]);

  const [provider, setProvider] = useState<PaymentProvider>('MOMO');
  const [pendingOrder, setPendingOrder] = useState<OrderSummary | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paidOrder, setPaidOrder] = useState<OrderSummary | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const eventHolds: Hold[] = isOrganizer
    ? testCart && Date.parse(testCart.expiresAt) > testNow
      ? testCartToHolds(testCart)
      : []
    : holds.filter(h => h.eventId === eventId || h.eventSlug === eventId);

  const activeNow = isOrganizer ? testNow : now;
  const first = eventHolds[0];
  const subtotal = eventHolds.reduce((sum, h) => sum + h.price, 0);
  const serviceFee = serviceFeeOf(subtotal);
  const finalTotal = subtotal + serviceFee;
  const seatsUrl = `/events/${first?.eventId ?? eventId}/tickets`;

  const handleReleaseSeat = (hold: Hold) => {
    setPaymentSession(null);
    if (isOrganizer && testCart) {
      const updated: OrganizerTestCart = {
        ...testCart,
        seats: testCart.seats.filter(s => s.id !== hold.seatId)
      };
      saveOrganizerTestCart(updated);
      setTestCart(updated.seats.length > 0 ? updated : null);
      return;
    }
    release(hold);
  };

  const handleStartPayment = async () => {
    if (!first || isInitiating) return;
    setPayError(null);

    if (isOrganizer) {
      const orderCode = randomCode('TEST-ORD');
      const paymentCode = randomCode(`TEST-${provider}`);
      setPaymentSession({
        paymentId: `preview-${Date.now()}`,
        paymentCode,
        orderId: `preview-order-${Date.now()}`,
        orderCode,
        provider,
        amount: finalTotal,
        currency: 'VND',
        status: 'INITIATED',
        expiresAt: first.expiresAt,
        ipnUrl: '',
        returnUrl: '',
        sandboxMode: true,
        sandboxTxnId: randomCode(`${provider}-SIM`),
        sandboxSignature: 'preview',
        sandboxFailTxnId: randomCode(`${provider}-FAIL`),
        sandboxFailSignature: 'preview'
      });
      return;
    }

    setIsInitiating(true);
    let order = pendingOrder;
    const heldIds = eventHolds.map(h => h.seatId).sort().join(',');
    const orderIds = order ? order.items.map(i => i.seatId).sort().join(',') : '';
    if (!order || order.status !== 'PENDING' || heldIds !== orderIds) {
      const created = await apiCreateOrder(
        first.eventId,
        provider,
        eventHolds.map(h => h.seatId)
      );
      if (!created.ok || !created.order) {
        setIsInitiating(false);
        setPayError(paymentErrorMessage(created.error));
        return;
      }
      order = created.order;
      setPendingOrder(order);
    }

    const initRes = await apiInitiatePayment(order.id, provider);
    setIsInitiating(false);
    if (!initRes.ok || !initRes.session) {
      setPayError(paymentErrorMessage(initRes.error));
      return;
    }
    setPaymentSession(initRes.session);
  };

  const handleSandboxCallback = async (result: 'SUCCESS' | 'FAILED') => {
    if (!paymentSession || isConfirming) return;

    if (isOrganizer) {
      if (result === 'FAILED') {
        setPaymentSession(null);
        setPayError('Mô phỏng giao dịch thất bại thành công. Ghế thử nghiệm vẫn giữ nguyên để bạn kiểm thử bước thử lại.');
        return;
      }
      const nowIso = new Date().toISOString();
      const simTickets: UserTicket[] = eventHolds.map((h, i) => ({
        id: `preview-ticket-${i}-${h.seatId}`,
        orderId: paymentSession.orderId,
        orderCode: paymentSession.orderCode,
        eventId: h.eventId,
        eventSlug: h.eventSlug,
        eventName: h.eventName,
        eventStartsAt: h.startsAt,
        eventCity: '',
        venueName: h.venueName,
        seatId: h.seatId,
        seatLabel: h.seatLabel,
        zoneId: '',
        zoneCode: '',
        zoneName: h.zoneName,
        price: h.price,
        paymentMethod: paymentSession.provider,
        ticketCode: randomCode('TEST-TKT'),
        status: 'ACTIVE',
        issuedAt: nowIso,
        paidAt: nowIso
      }));
      const simulatedOrder: OrderSummary = {
        id: paymentSession.orderId,
        orderCode: paymentSession.orderCode,
        eventId: first?.eventId ?? eventId,
        eventSlug: first?.eventSlug ?? eventId,
        eventName: first?.eventName ?? 'Sự kiện kiểm thử',
        eventStartsAt: first?.startsAt ?? nowIso,
        venueName: first?.venueName ?? '',
        status: 'PAID',
        subtotalAmount: subtotal,
        serviceFee,
        discountAmount: 0,
        finalAmount: finalTotal,
        currency: 'VND',
        paymentMethod: paymentSession.provider,
        expiresAt: paymentSession.expiresAt,
        paidAt: nowIso,
        createdAt: nowIso,
        items: eventHolds.map(h => ({
          seatId: h.seatId,
          seatLabel: h.seatLabel,
          zoneId: '',
          zoneCode: '',
          zoneName: h.zoneName,
          price: h.price
        })),
        tickets: simTickets
      };
      if (testCart) clearOrganizerTestCart(testCart.eventId);
      setTestCart(null);
      setPaymentSession(null);
      setPaidOrder(simulatedOrder);
      return;
    }

    const txnId =
      result === 'SUCCESS' ? paymentSession.sandboxTxnId : paymentSession.sandboxFailTxnId;
    const signature =
      result === 'SUCCESS' ? paymentSession.sandboxSignature : paymentSession.sandboxFailSignature;
    if (!txnId || !signature) {
      setPayError('Phiên thanh toán chưa có chữ ký xác thực hợp lệ.');
      return;
    }

    setPayError(null);
    setIsConfirming(true);
    const res = await apiSubmitPaymentIPN(paymentSession.provider, {
      paymentCode: paymentSession.paymentCode,
      providerTxnId: txnId,
      amount: paymentSession.amount,
      result,
      signature
    });
    setIsConfirming(false);

    if (!res.ok || !res.result) {
      setPayError(paymentErrorMessage(res.error));
      return;
    }

    if (res.result.status === 'FAILED') {
      setPaymentSession(null);
      setPayError('Giao dịch bị từ chối tại cổng thanh toán. Ghế vẫn đang được giữ — bạn có thể thử lại.');
      return;
    }

    setPaidOrder(res.result.order);
    setPaymentSession(null);
    setPendingOrder(null);
    invalidateAssistantCache();
    refresh();
  };

  let body: React.ReactNode;
  if (paidOrder) {
    const paidWhen = eventDate(paidOrder.eventStartsAt);
    body = (
      <div className="space-y-6">
        <section
          className={`rounded-card bg-kumo-base p-6 ring-2 sm:p-7 ${
            isOrganizer ? 'ring-kumo-warning/70' : 'ring-kumo-success/60'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full ${
                  isOrganizer
                    ? 'bg-kumo-warning-tint text-kumo-warning'
                    : 'bg-kumo-success-tint text-kumo-success'
                }`}
              >
                {isOrganizer ? <FlaskConical className="size-6" /> : <CheckCircle2 className="size-6" />}
              </span>
              <div>
                <p
                  className={`text-xs font-semibold tracking-wider uppercase ${
                    isOrganizer ? 'text-kumo-warning' : 'text-kumo-success'
                  }`}
                >
                  {isOrganizer ? 'Hoàn tất mô phỏng kiểm thử (BTC)' : 'Thanh toán thành công'}
                </p>
                <h2 className="type-display mt-1 text-2xl text-kumo-strong">
                  Đơn hàng {paidOrder.orderCode}
                </h2>
                <p className="mt-1 text-sm text-kumo-subtle">
                  {paidOrder.eventName} · {paidWhen.full}, {paidWhen.time} · {paidOrder.venueName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-xs text-kumo-subtle">
                {isOrganizer ? 'Số tiền mô phỏng' : `Đã thanh toán (${paidOrder.paymentMethod})`}
              </span>
              <span
                className={`type-figure text-2xl ${
                  isOrganizer ? 'text-kumo-warning' : 'text-kumo-success'
                }`}
              >
                {formatPrice(paidOrder.finalAmount)}
              </span>
            </div>
          </div>

          {isOrganizer && (
            <p className="mt-4 rounded-xl bg-kumo-warning-tint/80 px-3.5 py-2.5 text-xs text-kumo-warning">
              Không có bản ghi nào được ghi vào cơ sở dữ liệu — ghế vẫn còn nguyên trên sơ đồ và doanh thu thực không thay đổi.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3 border-t border-kumo-hairline pt-5">
            {isOrganizer ? (
              <>
                <Link to="/organizer" className="btn btn-primary">
                  Về Bảng điều khiển BTC
                </Link>
                <Link to={seatsUrl} className="btn btn-secondary">
                  Kiểm thử chọn ghế lại
                </Link>
              </>
            ) : (
              <>
                <Link to="/my-tickets" className="btn btn-primary">
                  <Ticket className="size-4" />
                  Mở Vé của tôi
                </Link>
                <Link to="/" className="btn btn-secondary">
                  Về lịch diễn
                </Link>
              </>
            )}
          </div>
        </section>

        {paidOrder.tickets && paidOrder.tickets.length > 0 && (
          <section aria-labelledby="issued-qr-heading" className="space-y-4">
            <div>
              <h3 id="issued-qr-heading" className="type-display text-title">
                {isOrganizer
                  ? `Vé mẫu kiểm thử (${paidOrder.tickets.length})`
                  : `Vé điện tử đã phát hành (${paidOrder.tickets.length})`}
              </h3>
              <p className="mt-1 text-sm text-kumo-subtle">
                {isOrganizer
                  ? 'Bản xem trước giao diện vé khách hàng sẽ nhận được sau khi thanh toán.'
                  : 'Mã QR cố định của từng vé đã sẵn sàng để lưu lại hoặc xuất trình tại cổng sự kiện.'}
              </p>
            </div>
            {paidOrder.tickets.map(ticket => (
              <div key={ticket.id} className="rounded-card bg-kumo-base p-4 ring ring-kumo-line sm:p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-kumo-strong">
                      Ghế {ticket.seatLabel} · {ticket.zoneName}
                    </p>
                    <p className="text-xs text-kumo-subtle">Mã vé: {ticket.ticketCode}</p>
                  </div>
                  <span className="type-figure text-sm text-kumo-strong">
                    {formatPrice(ticket.price)}
                  </span>
                </div>
                <TicketQRCard
                  ticket={ticket}
                  previewPayload={isOrganizer ? `PREVIEW-${ticket.ticketCode}-${ticket.seatLabel}` : undefined}
                />
              </div>
            ))}
          </section>
        )}
      </div>
    );
  } else if (featuresLoading || (!isOrganizer && holdEnabled && status === 'loading')) {
    body = <div aria-busy="true" className="skeleton h-56 w-full rounded-card" />;
  } else if (!holdEnabled) {
    body = <EmptyState title="Giữ chỗ đang tạm tắt" body="Hiện chưa giữ được ghế cho sự kiện này." />;
  } else if (!isOrganizer && status === 'error') {
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
        title={isOrganizer ? 'Chưa có ghế kiểm thử nào được chọn' : 'Bạn chưa giữ ghế nào cho sự kiện này'}
        body={
          isOrganizer
            ? 'Quay lại sơ đồ sân khấu để chọn thử ghế và chạy mô phỏng thanh toán.'
            : 'Ghế giữ quá 5 phút sẽ tự được trả lại. Chọn lại ghế trên sơ đồ để tiếp tục.'
        }
        action={
          <Link to={seatsUrl} className="btn btn-primary">
            {isOrganizer ? 'Chọn ghế kiểm thử' : 'Chọn ghế'}
          </Link>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-5">
        <section aria-labelledby="holds-title" className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-7">
          <h2 id="holds-title" className="type-display text-title">
            {isOrganizer ? `${eventHolds.length} ghế đang chọn thử` : `${eventHolds.length} ghế đang giữ`}
          </h2>
          {!isOrganizer && releaseError && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {releaseError}
            </p>
          )}
          <HoldList
            holds={eventHolds}
            now={activeNow}
            releasingId={isOrganizer ? null : releasingId}
            onRelease={handleReleaseSeat}
          />

          <dl className="space-y-1.5 border-t border-kumo-hairline pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-kumo-subtle">Tạm tính ({eventHolds.length} vé)</dt>
              <dd className="tabular-nums text-kumo-default">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-kumo-subtle">Phí dịch vụ ({Math.round(SERVICE_FEE_RATE * 100)}%)</dt>
              <dd className="tabular-nums text-kumo-default">{formatPrice(serviceFee)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-kumo-contrast pt-3">
              <dt className="font-semibold text-kumo-strong">
                {isOrganizer ? 'Tổng thanh toán (Mô phỏng)' : 'Tổng thanh toán'}
              </dt>
              <dd className="type-figure text-3xl text-kumo-strong">{formatPrice(finalTotal)}</dd>
            </div>
          </dl>
        </section>

        {paymentsEnabled ? (
          paymentSession ? (
            <section
              aria-labelledby="sandbox-gateway-heading"
              className="rounded-card bg-kumo-base p-5 ring-2 ring-violet-ink sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet/20 px-2.5 py-0.5 text-xs font-semibold text-violet-ink">
                    <ShieldCheck className="size-3.5" />
                    {isOrganizer
                      ? `Mô phỏng cổng ${paymentSession.provider} (Không ghi DB)`
                      : `Cổng thanh toán ${paymentSession.provider} (HMAC IPN)`}
                  </span>
                  <h2 id="sandbox-gateway-heading" className="type-display mt-2 text-title">
                    Xác nhận thanh toán đơn {paymentSession.orderCode}
                  </h2>
                </div>
                <span className="type-figure text-2xl text-kumo-strong">
                  {formatPrice(paymentSession.amount)}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-kumo-recessed p-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-kumo-subtle">Mã giao dịch</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-kumo-strong">
                    {paymentSession.paymentCode}
                  </dd>
                </div>
                <div>
                  <dt className="text-kumo-subtle">Mã tham chiếu đối soát</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-kumo-strong">
                    {paymentSession.sandboxTxnId}
                  </dd>
                </div>
              </dl>

              {payError && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {payError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSandboxCallback('SUCCESS')}
                  disabled={isConfirming}
                  className="btn btn-primary"
                >
                  <CheckCircle2 className="size-4" />
                  {isConfirming
                    ? 'Đang đối soát giao dịch...'
                    : isOrganizer
                      ? 'Mô phỏng thanh toán thành công'
                      : 'Xác nhận thanh toán thành công'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSandboxCallback('FAILED')}
                  disabled={isConfirming}
                  className="btn btn-secondary"
                >
                  <XCircle className="size-4 text-kumo-danger" />
                  Giả lập lỗi thanh toán
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentSession(null);
                    setPayError(null);
                  }}
                  disabled={isConfirming}
                  className="btn btn-quiet btn-sm"
                >
                  Đổi phương thức
                </button>
              </div>
            </section>
          ) : (
            <section
              aria-labelledby="payment-method-heading"
              className="rounded-card bg-kumo-base p-5 ring ring-kumo-line sm:p-7"
            >
              <h2 id="payment-method-heading" className="type-display text-title">
                Chọn phương thức thanh toán
              </h2>
              <p className="mt-1 text-sm text-kumo-subtle">
                {isOrganizer
                  ? 'Kiểm thử trải nghiệm chọn cổng thanh toán của khách hàng (mọi thao tác chỉ mô phỏng cục bộ).'
                  : 'Vé điện tử kèm mã QR cố định sẽ được phát hành ngay sau khi cổng xác nhận IPN.'}
              </p>

              <div role="radiogroup" aria-label="Phương thức thanh toán" className="mt-4 space-y-2.5">
                {PROVIDERS.map(item => {
                  const active = provider === item.id;
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setProvider(item.id);
                        setPayError(null);
                      }}
                      className={`flex w-full items-center gap-3.5 rounded-xl p-4 text-left transition-colors ${
                        active
                          ? 'bg-kumo-tint ring-2 ring-violet-ink'
                          : 'bg-kumo-recessed/70 ring ring-kumo-line hover:ring-kumo-interact'
                      }`}
                    >
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-kumo-base ${item.accent}`}>
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-kumo-strong">{item.name}</span>
                        <span className="block text-xs text-kumo-subtle">{item.subtitle}</span>
                      </span>
                      <span
                        className={`size-4 shrink-0 rounded-full border-2 ${
                          active ? 'border-violet-ink bg-violet-ink' : 'border-kumo-interact'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {payError && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-kumo-danger-tint p-3 text-sm text-kumo-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {payError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-5">
                <p className="flex items-center gap-1.5 text-xs text-kumo-subtle">
                  <Lock className="size-3.5 text-kumo-success" />
                  {isOrganizer
                    ? 'Chế độ kiểm thử BTC — không trừ ghế thật'
                    : 'Giao dịch được ký HMAC-SHA256 & chống trùng lặp IPN'}
                </p>
                <button
                  type="button"
                  onClick={handleStartPayment}
                  disabled={isInitiating}
                  className="btn btn-primary h-12 px-6"
                >
                  <CreditCard className="size-4" />
                  {isInitiating
                    ? 'Đang khởi tạo đơn...'
                    : isOrganizer
                      ? `Mô phỏng thanh toán ${formatPrice(finalTotal)}`
                      : `Thanh toán ${formatPrice(finalTotal)}`}
                </button>
              </div>
            </section>
          )
        ) : (
          <p className="rounded-card bg-kumo-recessed p-5 text-kumo-default">
            Thanh toán đang tạm tắt ở cấu hình hiện tại. Ghế được giữ trong 5 phút.
          </p>
        )}

        <Link to={seatsUrl} className="btn btn-secondary">
          Chọn thêm hoặc đổi ghế
        </Link>
      </div>
    );
  }

  const headerEventName = paidOrder?.eventName ?? first?.eventName;
  const headerStartsAt = paidOrder?.eventStartsAt ?? first?.startsAt;
  const headerVenue = paidOrder?.venueName ?? first?.venueName;
  const when = headerStartsAt ? eventDate(headerStartsAt) : null;

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />

      <main className="page-enter mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-20 sm:px-6">
        <Link to={`/event/${paidOrder?.eventId ?? first?.eventId ?? eventId}`} className="btn btn-quiet btn-sm -ml-3">
          <ArrowLeft className="size-4" />
          Về trang sự kiện
        </Link>

        {isOrganizer && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-kumo-warning-tint/85 px-4 py-3 text-sm text-kumo-warning ring ring-kumo-warning/30"
          >
            <div className="flex items-start gap-2.5">
              <FlaskConical className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>Chế độ kiểm thử thanh toán (Ban Tổ Chức):</strong> Tài khoản Ban Tổ Chức không cần mua vé thật — mọi bước thanh toán và sinh QR đều mô phỏng cục bộ, không ghi database.
              </p>
            </div>
            <Link to="/organizer" className="btn btn-secondary btn-sm h-8 shrink-0 text-xs">
              Bảng điều khiển BTC
            </Link>
          </div>
        )}

        <h1 className="type-display mt-4 text-display-sm">
          {paidOrder
            ? isOrganizer
              ? 'Kết quả kiểm thử đặt vé'
              : 'Xác nhận đặt vé'
            : isOrganizer
              ? 'Kiểm thử thanh toán (BTC)'
              : paymentsEnabled
                ? 'Thanh toán đơn vé'
                : 'Ghế đang giữ'}
        </h1>
        {headerEventName && when && (
          <p className="mt-2 text-kumo-subtle">
            {headerEventName} · {when.full}, {when.time} · {headerVenue}
          </p>
        )}
        <div className="mt-8">{body}</div>
      </main>

      <Footer />
    </PageShell>
  );
};
