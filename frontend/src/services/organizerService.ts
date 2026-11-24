import { StageLayoutConfig } from '../types';

export interface OrganizerEvent {
  id: string;
  name: string;
  slug: string;
  status: string;
  startsAt: string;
  imageUrl?: string;
  venueName?: string;
}

export interface CreateEventZonePayload {
  code: string;
  name: string;
  floor?: string;
  kind: 'seated' | 'standing';
  rows: number;
  seatsPerRow: number;
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  isDynamicPricingEnabled: boolean;
  color?: string;
}

export interface CreateOrganizerEventPayload {
  name: string;
  description: string;
  genre: string;
  city: string;
  venueName: string;
  venueAddress: string;
  imageUrl: string;
  imageCredit?: string;
  startsAt: string;
  endsAt: string;
  status: 'ON_SALE' | 'DRAFT';
  maxTicketsPerUser: number;
  waitingRoomEnabled?: boolean;
  layoutConfig: StageLayoutConfig;
  zones: CreateEventZonePayload[];
}

export interface CreatedOrganizerEvent extends OrganizerEvent {
  endsAt: string;
  city: string;
  zoneCount: number;
  totalCapacity: number;
  layoutConfig: StageLayoutConfig;
}

export interface ZonePricing {
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
}

export interface OrganizerZone extends ZonePricing {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  zoneKind?: 'seated' | 'standing';
  floor?: string;
  capacity: number;
  isDynamicPricingEnabled: boolean;
}

export interface ZoneSalesSummary {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  kind: 'seated' | 'standing';
  capacity: number;
  sold: number;
  held: number;
  available: number;
  fillRate: number;
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  isDynamicPricingEnabled: boolean;
  realizedRevenue: number;
  heldPipelineRevenue: number;
  potentialRevenue: number;
  priceHeadroomPct: number;
}

export interface EventSalesSummary {
  eventId: string;
  eventName: string;
  slug: string;
  city: string;
  venueName: string;
  startsAt: string;
  layoutConfig?: StageLayoutConfig;
  totalCapacity: number;
  soldCount: number;
  heldCount: number;
  availableCount: number;
  fillRate: number;
  realizedRevenue: number;
  heldPipelineRevenue: number;
  potentialRevenue: number;
  remainingRevenue: number;
  standingFillRate: number;
  seatedFillRate: number;
  hotZones: string[];
  slowZones: string[];
  zones: ZoneSalesSummary[];
}

export interface OrganizerSalesOverview {
  eventCount: number;
  totalCapacity: number;
  soldCount: number;
  heldCount: number;
  availableCount: number;
  fillRate: number;
  realizedRevenue: number;
  heldPipelineRevenue: number;
  potentialRevenue: number;
  remainingRevenue: number;
  events: EventSalesSummary[];
}

export async function apiFetchOrganizerSalesOverview(): Promise<OrganizerSalesOverview | null> {
  try {
    const res = await fetch('/api/organizer/sales-overview', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiFetchEventSalesSummary(eventId: string): Promise<EventSalesSummary | null> {
  try {
    const res = await fetch(`/api/organizer/events/${encodeURIComponent(eventId)}/sales-summary`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiFetchOrganizerEvents(): Promise<OrganizerEvent[]> {
  const res = await fetch('/api/organizer/events', { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) ?? [];
}

export async function apiFetchEventZones(eventId: string): Promise<OrganizerZone[]> {
  const res = await fetch(`/api/events/${eventId}`, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  const ev = await res.json();
  return ev.zones ?? [];
}

// Resolves to null on success, otherwise the API error code.
export async function apiUpdateZonePricing(
  eventId: string,
  zoneId: string,
  pricing: ZonePricing
): Promise<string | null> {
  try {
    const res = await fetch(`/api/organizer/events/${eventId}/zones/${zoneId}/pricing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(pricing),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.error ?? `http_${res.status}`;
  } catch {
    return 'network_error';
  }
}

export async function apiCreateOrganizerEvent(
  payload: CreateOrganizerEventPayload
): Promise<{ event?: CreatedOrganizerEvent; error?: string }> {
  try {
    const res = await fetch('/api/organizer/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { error: data?.error ?? `http_${res.status}` };
    }
    return { event: data as CreatedOrganizerEvent };
  } catch {
    return { error: 'network_error' };
  }
}

export async function apiUpdateEventLayout(
  eventId: string,
  layoutConfig: StageLayoutConfig
): Promise<{ layoutConfig?: StageLayoutConfig; error?: string }> {
  try {
    const res = await fetch(`/api/organizer/events/${encodeURIComponent(eventId)}/layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(layoutConfig),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { error: data?.error ?? `http_${res.status}` };
    }
    return { layoutConfig: data as StageLayoutConfig };
  } catch {
    return { error: 'network_error' };
  }
}

const PRICING_ERROR_MESSAGES: Record<string, string> = {
  invalid_price_bounds: 'Giá không hợp lệ: cần thỏa mãn 0 ≤ giá sàn ≤ giá cơ bản ≤ giá trần.',
  invalid_event_payload: 'Vui lòng điền đầy đủ tên sự kiện, địa điểm và thành phố.',
  invalid_event_schedule: 'Thời gian kết thúc phải sau thời gian bắt đầu.',
  invalid_zones: 'Cấu hình khu vực chưa hợp lệ (mã khu trùng lặp, số hàng/ghế hoặc tổng sức chứa vượt quá 1.500 ghế).',
  not_event_organizer: 'Bạn không phải ban tổ chức của sự kiện này.',
  feature_disabled: 'Tính năng quản lý sự kiện hiện đang tắt.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  network_error: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
};

export function pricingErrorMessage(code: string): string {
  return PRICING_ERROR_MESSAGES[code] ?? 'Không thể lưu thay đổi. Vui lòng thử lại.';
}
