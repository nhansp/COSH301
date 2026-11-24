// Client for the organizer's dynamic pricing dashboard (FR-22).

export type PricingMode = 'OFF' | 'MANUAL' | 'AUTO';
export type PricingAction = 'INCREASE' | 'DECREASE' | 'MAINTAIN';
export type DemandLevel = 'LOW' | 'ON_TRACK' | 'HIGH';

export interface PricingFactor {
  key: string;
  value: number;
  effect: number;
  text: string;
}

export interface PricingRecommendation {
  action: PricingAction;
  price: number;
  rangeLow: number;
  rangeHigh: number;
  suggestedFloor: number;
  suggestedCeiling: number;
  demandIndex: number;
  demandLevel: DemandLevel;
  performance: number;
  actualShare: number;
  expectedShare: number;
  velocity: number;
  requiredVelocity: number;
  conversion: number;
  confidence: number;
  insufficientData: boolean;
  salesClosed: boolean;
  soldOut: boolean;
  atFloor: boolean;
  atCeiling: boolean;
  factors: PricingFactor[] | null;
  explanation: string;
}

export interface PriceSuggestion {
  id: string;
  zoneId: string;
  suggestedPrice: number;
  currentPrice: number;
  reason: string;
  createdAt: string;
}

export interface ZonePricingView {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  included: boolean;
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  listPrice: number;
  boundsApprovedAt?: string;
  capacity: number;
  available: number;
  held: number;
  sold: number;
  holds1h: number;
  holds24h: number;
  sales24h: number;
  lastChangeAt?: string;
  autoBlockedBy?: string;
  recommendation: PricingRecommendation;
  pending?: PriceSuggestion;
}

export interface DemandPoint {
  at: string;
  holds: number;
  sales: number;
  views: number;
}

export interface PricingOverview {
  eventId: string;
  eventName: string;
  mode: PricingMode;
  enabled: boolean;
  autoAdjust: boolean;
  maxStepPct: number;
  cooldownMinutes: number;
  salesOpenAt: string;
  salesCloseAt: string;
  paymentsLive: boolean;
  unreadAlerts: number;
  analyzedAt: string;
  zones: ZonePricingView[] | null;
  demand: DemandPoint[] | null;
}

export interface PricingSettings {
  enabled: boolean;
  autoAdjust: boolean;
  maxStepPct: number;
  cooldownMinutes: number;
}

export type PriceTrigger = 'MANUAL' | 'SUGGESTION' | 'AUTO';

export interface PriceChange {
  id: number;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  oldPrice: number;
  newPrice: number;
  trigger: PriceTrigger | string;
  details?: string;
  changedByName?: string;
  createdAt: string;
}

export interface PricingAlert {
  id: string;
  zoneId?: string;
  zoneCode?: string;
  zoneName?: string;
  kind: string;
  message: string;
  read: boolean;
  createdAt: string;
}

/** Resolves to the parsed body, or throws an Error whose message is the API error code. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', ...init });
  } catch {
    throw new Error('network_error');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `http_${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const base = (eventId: string) => `/api/organizer/events/${encodeURIComponent(eventId)}`;

export const fetchPricingOverview = (eventId: string) => request<PricingOverview>(`${base(eventId)}/pricing`);

export const savePricingSettings = (eventId: string, s: PricingSettings) =>
  request<PricingOverview>(`${base(eventId)}/pricing/settings`, json('PUT', s));

export const analyzePricingNow = (eventId: string) =>
  request<PricingOverview>(`${base(eventId)}/pricing/analyze`, { method: 'POST' });

export const setZoneIncluded = (eventId: string, zoneId: string, included: boolean) =>
  request<void>(`${base(eventId)}/zones/${encodeURIComponent(zoneId)}/dynamic-pricing`, json('PUT', { included }));

export const fetchPriceHistory = (eventId: string) => request<PriceChange[]>(`${base(eventId)}/pricing/history`);

export const fetchPricingAlerts = (eventId: string) => request<PricingAlert[]>(`${base(eventId)}/pricing/alerts`);

export const markAlertRead = (alertId: string) =>
  request<void>(`/api/organizer/pricing/alerts/${encodeURIComponent(alertId)}/read`, { method: 'POST' });

export const markAllAlertsRead = (eventId: string) => request<void>(`${base(eventId)}/pricing/alerts/read`, { method: 'POST' });

export const approveSuggestion = (id: string) =>
  request<void>(`/api/organizer/suggestions/${encodeURIComponent(id)}/approve`, { method: 'POST' });

export const rejectSuggestion = (id: string) =>
  request<void>(`/api/organizer/suggestions/${encodeURIComponent(id)}/reject`, { method: 'POST' });

/** Server-sent pricing alerts and updates for one event; returns a function that closes the stream. */
export function subscribePricing(eventId: string, onChange: () => void): () => void {
  const sse = new EventSource(`${base(eventId)}/pricing/stream`);
  sse.addEventListener('update', onChange);
  return () => sse.close();
}

const PRICING_ERRORS: Record<string, string> = {
  bounds_not_approved: 'Hãy lưu (duyệt) giá sàn, giá trần của mọi khu vực tham gia trước khi bật tự động.',
  invalid_pricing_settings: 'Cài đặt không hợp lệ: bước đổi giá 1–20%, thời gian chờ 5–1440 phút.',
  suggestion_stale: 'Giá khu vực đã đổi sau khi có đề xuất. Hãy phân tích lại.',
  suggestion_not_pending: 'Đề xuất này đã được xử lý.',
  not_event_organizer: 'Bạn không phải ban tổ chức của sự kiện này.',
  feature_disabled: 'Tính năng định giá động đang tắt.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  network_error: 'Không thể kết nối máy chủ. Vui lòng thử lại.'
};

export function pricingError(err: unknown): string {
  const code = err instanceof Error ? err.message : String(err);
  return PRICING_ERRORS[code] ?? 'Không thể thực hiện. Vui lòng thử lại.';
}

export const TRIGGER_LABEL: Record<string, string> = {
  MANUAL: 'Thủ công',
  SUGGESTION: 'Duyệt đề xuất AI',
  AUTO: 'Tự động'
};

export const AUTO_BLOCK_LABEL: Record<string, string> = {
  cooldown: 'Đang trong thời gian chờ sau lần đổi giá gần nhất.',
  reversal_guard: 'Tạm không đổi ngược chiều lần đổi giá trước, để tránh giá dao động.',
  insufficient_data: 'Chưa đủ dữ liệu để tự động đổi giá.',
  maintain: 'Giá hiện tại phù hợp, không cần đổi.',
  bounds_not_approved: 'Chưa duyệt giá sàn, giá trần nên không tự động đổi giá.'
};
