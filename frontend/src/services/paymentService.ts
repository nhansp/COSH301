export type PaymentProvider = 'MOMO' | 'VNPAY' | 'VIETQR';

export interface OrderItem {
  seatId: string;
  seatLabel: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  price: number;
}

export interface PaymentSummary {
  id: string;
  paymentCode: string;
  provider: string;
  providerTxnId?: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface UserTicket {
  id: string;
  orderId: string;
  orderCode: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  eventStartsAt: string;
  eventCity: string;
  eventImageUrl?: string;
  venueName: string;
  venueAddress?: string;
  seatId: string;
  seatLabel: string;
  rowLabel?: string;
  seatNumber?: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  price: number;
  paymentMethod?: string;
  ticketCode: string;
  status: string;
  issuedAt: string;
  paidAt?: string;
}

export interface OrderSummary {
  id: string;
  orderCode: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  eventStartsAt: string;
  venueName: string;
  status: string;
  subtotalAmount: number;
  serviceFee: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  paymentMethod?: string;
  expiresAt: string;
  paidAt?: string;
  createdAt: string;
  items: OrderItem[];
  payments?: PaymentSummary[];
  tickets?: UserTicket[];
}

export interface PaymentSession {
  paymentId: string;
  paymentCode: string;
  orderId: string;
  orderCode: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: string;
  expiresAt: string;
  ipnUrl: string;
  returnUrl: string;
  sandboxMode: boolean;
  sandboxTxnId?: string;
  sandboxSignature?: string;
  sandboxFailTxnId?: string;
  sandboxFailSignature?: string;
}

export interface IPNResult {
  idempotent: boolean;
  status: string;
  order: OrderSummary;
}

export interface TicketQRPayload {
  ticketId: string;
  ticketCode: string;
  payload: string;
  status: string;
}

export interface CancelledTicketItem {
  id: number;
  bookingId?: string;
  bookingCode?: string;
  eventId: string;
  eventTitle: string;
  concert?: {
    id?: string;
    name?: string;
    title?: string;
    slug?: string;
    venue?: string;
    city?: string;
    startsAt?: string;
    endsAt?: string;
  };
  seats: string[];
  releasedSeats: string[];
  reason: string;
  cancelledAt: string;
}

const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  no_active_holds: 'Các ghế bạn giữ đã hết hạn 5 phút. Vui lòng quay lại sơ đồ để chọn ghế mới.',
  invalid_payment_provider: 'Phương thức thanh toán không hợp lệ.',
  order_not_found: 'Không tìm thấy đơn hàng.',
  order_not_pending: 'Đơn hàng này không còn ở trạng thái chờ thanh toán.',
  order_expired: 'Đơn hàng đã hết thời gian giữ chỗ.',
  invalid_signature: 'Chữ ký xác thực cổng thanh toán không hợp lệ.',
  amount_mismatch: 'Số tiền thanh toán không khớp với đơn hàng.',
  seat_conflict_refunded: 'Một hoặc nhiều ghế đã được người khác mua sau khi hết hạn giữ chỗ. Hệ thống đã ghi nhận hoàn tiền tự động.',
  feature_disabled: 'Tính năng thanh toán hiện đang tạm tắt.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  network_error: 'Không kết nối được máy chủ. Vui lòng thử lại.'
};

export function paymentErrorMessage(code?: string): string {
  if (!code) return 'Thanh toán chưa hoàn tất. Vui lòng thử lại.';
  return PAYMENT_ERROR_MESSAGES[code] ?? 'Không thể xử lý giao dịch lúc này. Vui lòng thử lại.';
}

export async function apiCreateOrder(
  eventId: string,
  paymentMethod?: PaymentProvider,
  seatIds?: string[]
): Promise<{ ok: boolean; order?: OrderSummary; error?: string }> {
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, paymentMethod, seatIds })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `http_${res.status}` };
    return { ok: true, order: data as OrderSummary };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function apiInitiatePayment(
  orderId: string,
  provider: PaymentProvider
): Promise<{ ok: boolean; session?: PaymentSession; error?: string }> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `http_${res.status}` };
    return { ok: true, session: data as PaymentSession };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function apiSubmitPaymentIPN(
  provider: PaymentProvider,
  payload: {
    paymentCode: string;
    providerTxnId: string;
    amount: number;
    result: 'SUCCESS' | 'FAILED';
    signature: string;
  }
): Promise<{ ok: boolean; result?: IPNResult; error?: string }> {
  try {
    const res = await fetch(`/api/payments/${provider.toLowerCase()}/ipn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `http_${res.status}` };
    return { ok: true, result: data as IPNResult };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function apiFetchMyTickets(): Promise<UserTicket[] | null> {
  try {
    const res = await fetch('/api/me/tickets', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as UserTicket[]) : [];
  } catch {
    return null;
  }
}

export async function apiFetchTicketQR(ticketId: string): Promise<TicketQRPayload | null> {
  try {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/qr`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    return (await res.json()) as TicketQRPayload;
  } catch {
    return null;
  }
}

export async function apiFetchCancelledTickets(): Promise<CancelledTicketItem[] | null> {
  try {
    const res = await fetch('/api/tickets/cancelled', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as CancelledTicketItem[]) : [];
  } catch {
    return null;
  }
}

export async function apiCancelTicket(
  eventId: string,
  seats: string[],
  bookingCode: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/tickets/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, seats, bookingCode, reason })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `http_${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
