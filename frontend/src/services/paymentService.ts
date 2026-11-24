import { Ticket } from '../types';

/** A pending order priced by the server, with the VNPay page that pays it. */
export interface Checkout {
  orderId: string;
  orderCode: string;
  subtotal: number;
  serviceFee: number;
  total: number;
  expiresAt: string;
  paymentUrl: string;
}

export type CheckoutError = 'no_active_holds' | 'holds_expiring' | 'event_not_on_sale' | 'unauthorized' | 'unavailable';

export type CheckoutResult = { kind: 'ok'; checkout: Checkout } | { kind: 'error'; error: CheckoutError };

const KNOWN_CHECKOUT_ERRORS: CheckoutError[] = ['no_active_holds', 'holds_expiring', 'event_not_on_sale'];

/** Asks the server to price the caller's holds and start a VNPay payment. */
export async function apiCreateVNPayPayment(eventId: string): Promise<CheckoutResult> {
  try {
    const res = await fetch('/api/payments/vnpay/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    if (res.status === 401) return { kind: 'error', error: 'unauthorized' };
    const body = await res.json().catch(() => null);
    if (res.ok && body?.paymentUrl) return { kind: 'ok', checkout: body };
    const known = KNOWN_CHECKOUT_ERRORS.find(code => code === body?.error);
    return { kind: 'error', error: known ?? 'unavailable' };
  } catch {
    return { kind: 'error', error: 'unavailable' };
  }
}

/** `processing` means VNPay reported success but its server notification has not arrived yet. */
export type PaymentStatus = 'paid' | 'processing' | 'failed' | 'refund_pending';

export interface PaymentOutcome {
  status: PaymentStatus;
  orderCode: string;
  eventId: string;
  amount: number;
  ticketCount: number;
  /** vnp_ResponseCode as VNPay sent it; "00" is success. */
  responseCode: string;
}

export type ReturnResult =
  | { kind: 'ok'; outcome: PaymentOutcome }
  | { kind: 'invalid' }
  | { kind: 'unknown' }
  | { kind: 'error' };

/**
 * Sends the query string VNPay appended to the return URL to the server, which
 * checks the signature and reports what its payment notification recorded.
 */
export async function apiVerifyVNPayReturn(search: string): Promise<ReturnResult> {
  try {
    const res = await fetch(`/api/payments/vnpay/return${search}`);
    if (res.ok) return { kind: 'ok', outcome: await res.json() };
    if (res.status === 400) return { kind: 'invalid' };
    if (res.status === 404) return { kind: 'unknown' };
    return { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

/** The caller's issued tickets, or null when unavailable. */
export async function apiFetchMyTickets(): Promise<Ticket[] | null> {
  try {
    const res = await fetch('/api/tickets', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** What VNPay's vnp_ResponseCode means to the customer, in Vietnamese. */
const RESPONSE_MESSAGES: Record<string, string> = {
  '07': 'Giao dịch bị nghi ngờ gian lận. Ngân hàng sẽ liên hệ với bạn.',
  '09': 'Thẻ hoặc tài khoản chưa đăng ký Internet Banking.',
  '10': 'Bạn nhập sai thông tin thẻ quá 3 lần.',
  '11': 'Đã hết thời gian thanh toán.',
  '12': 'Thẻ hoặc tài khoản đang bị khóa.',
  '13': 'Bạn nhập sai mã OTP.',
  '24': 'Bạn đã hủy giao dịch.',
  '51': 'Tài khoản không đủ số dư.',
  '65': 'Tài khoản đã vượt hạn mức giao dịch trong ngày.',
  '75': 'Ngân hàng đang bảo trì.',
  '79': 'Bạn nhập sai mật khẩu thanh toán quá số lần cho phép.',
};

export function failureMessage(responseCode: string): string {
  return RESPONSE_MESSAGES[responseCode] ?? 'Giao dịch chưa thành công.';
}
