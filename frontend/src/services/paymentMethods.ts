/** Payment options offered at checkout; the id is what a booking stores. */
export const PAYMENT_METHODS = [
  { id: 'momo_qr', name: 'Ví MoMo', desc: 'Quét mã QR trong ứng dụng MoMo' },
  { id: 'vnpay', name: 'VNPAY', desc: 'Thẻ ATM nội địa hoặc QR ngân hàng' },
  { id: 'visa_master', name: 'Thẻ quốc tế', desc: 'Visa, Mastercard, JCB' }
] as const;

export function paymentMethodName(id: string): string {
  return PAYMENT_METHODS.find(m => m.id === id)?.name ?? id;
}
