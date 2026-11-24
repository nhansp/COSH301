// Dynamic pricing (FR-22): the engine suggests, the organizer decides.

export interface ZoneInputs {
  velocityActual: number;
  velocityTarget: number;
  velocityRatio: number;
  demandSeats: number;
  windowMinutes: number;
  minutesLeft: number;
  remaining: number;
  held: number;
  sold: number;
  total: number;
  heldRatio: number;
  fillRate: number;
  queue: number;
  alpha: number;
  delta: number;
}

export interface PriceSuggestion {
  id: string;
  currentPrice: number;
  suggestedPrice: number;
  changePercent: number;
  reason: string;
  /** The measurements the suggestion was made from. */
  inputs: ZoneInputs;
  createdAt: string;
  updatedAt: string;
}

export interface PricePreview {
  suggestedPrice: number;
  changePercent: number;
  /** True when the change reaches the threshold and would become a suggestion. */
  significant: boolean;
}

export interface PricePoint {
  at: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
}

export interface ZonePricingState {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  floor: string;
  capacity: number;
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  isDynamicPricingEnabled: boolean;
  analysis: 'ok' | 'sold_out' | 'sales_closed';
  inputs: ZoneInputs | null;
  preview: PricePreview | null;
  pending: PriceSuggestion | null;
  history: PricePoint[];
}

export interface PricingSettings {
  intervalSeconds: number;
  windowMinutes: number;
  targetHorizonMinutes: number;
  minChangePercent: number;
  maxStepPercent: number;
  roundTo: number;
}

export interface PricingOverview {
  eventId: string;
  generatedAt: string;
  lastRunAt: string | null;
  settings: PricingSettings;
  zones: ZonePricingState[];
}

export interface RunSummary {
  zones: number;
  created: number;
  updated: number;
  withdrawn: number;
}

export interface ApprovalResult {
  suggestionId: string;
  zoneId: string;
  oldPrice: number;
  newPrice: number;
  repricedSeats: number;
}

/** `data` is set when `ok`, `error` is an API error code otherwise. */
export interface Result<T> {
  ok: boolean;
  data: T | null;
  error: string;
}

async function call<T>(method: string, url: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, data: null, error: data?.error ?? `http_${res.status}` };
    return { ok: true, data: data as T, error: '' };
  } catch {
    return { ok: false, data: null, error: 'network_error' };
  }
}

export const apiFetchPricingOverview = (eventId: string) =>
  call<PricingOverview>('GET', `/api/organizer/events/${eventId}/pricing`);

export const apiRunPricingNow = (eventId: string) =>
  call<{ run: RunSummary; overview: PricingOverview }>('POST', `/api/organizer/events/${eventId}/pricing/run`);

export const apiApproveSuggestion = (id: string) =>
  call<ApprovalResult>('POST', `/api/organizer/suggestions/${id}/approve`);

export const apiRejectSuggestion = (id: string) =>
  call<{ status: string }>('POST', `/api/organizer/suggestions/${id}/reject`);

export const apiSetZoneDynamicPricing = (eventId: string, zoneId: string, enabled: boolean) =>
  call<{ enabled: boolean }>('PUT', `/api/organizer/events/${eventId}/zones/${zoneId}/dynamic-pricing`, { enabled });

const PRICING_ERRORS: Record<string, string> = {
  suggestion_not_pending: 'Đề xuất này đã được xử lý. Bảng giá vừa được tải lại.',
  suggestion_stale: 'Giá hoặc giá sàn, giá trần của khu vực đã đổi sau khi đề xuất được tạo. Hãy chạy lại phân tích.',
  suggestion_not_found: 'Không tìm thấy đề xuất.',
  not_event_organizer: 'Bạn không phải ban tổ chức của sự kiện này.',
  forbidden: 'Tài khoản của bạn không có quyền xử lý đề xuất giá.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  feature_disabled: 'Định giá động đang tắt.',
  rate_limited: 'Bạn bấm quá nhanh. Thử lại sau giây lát.',
  network_error: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
};

export function pricingActionError(code: string): string {
  return PRICING_ERRORS[code] ?? 'Không thực hiện được. Vui lòng thử lại.';
}

/** "+5,0%" or "−12,5%"; the real minus sign keeps the sign aligned in tables. */
export function formatPercent(value: number, digits = 1): string {
  const abs = Math.abs(value).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (value > 0) return `+${abs}%`;
  if (value < 0) return `−${abs}%`;
  return `${abs}%`;
}
