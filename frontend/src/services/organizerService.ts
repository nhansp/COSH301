export interface OrganizerEvent {
  id: string;
  name: string;
  slug: string;
  status: string;
  startsAt: string;
  endsAt: string;
  imageUrl?: string;
  genre?: string;
  city?: string;
  venueName?: string;
  venueAddress?: string;
  /** Pricing alerts the organizer has not read yet. */
  unreadAlerts?: number;
  capacity: number;
  available: number;
  held: number;
  sold: number;
}

/** The editable information of an event, as GET/PUT /api/organizer/events/{id} send it. */
export interface EventInfo {
  name: string;
  description: string;
  genre: string;
  imageUrl: string;
  imageCredit: string;
  city: string;
  startsAt: string;
  endsAt: string;
  salesStartsAt: string | null;
  salesEndsAt: string | null;
  status: string;
  maxTicketsPerUser: number;
  venueName: string;
  venueAddress: string;
}

export interface ZoneInventory {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  floor?: string;
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  dynamicPricing: boolean;
  capacity: number;
  available: number;
  held: number;
  sold: number;
}

export interface OrganizerEventDetail extends EventInfo {
  id: string;
  slug: string;
  /** Other events use the same venue, so its name and address cannot be edited here. */
  venueShared: boolean;
  updatedAt: string;
  zones: ZoneInventory[] | null;
}

/** Thrown when a save is refused; `field` names the rejected field when the server says which. */
export class EventSaveError extends Error {
  constructor(public code: string, public field?: string) {
    super(code);
  }
}

export async function apiFetchOrganizerEvent(eventId: string): Promise<OrganizerEventDetail> {
  const res = await fetch(`/api/organizer/events/${encodeURIComponent(eventId)}`, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new EventSaveError(data?.error ?? `http_${res.status}`);
  }
  return res.json();
}

export async function apiUpdateOrganizerEvent(eventId: string, info: EventInfo): Promise<OrganizerEventDetail> {
  let res: Response;
  try {
    res = await fetch(`/api/organizer/events/${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info)
    });
  } catch {
    throw new EventSaveError('network_error');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new EventSaveError(data?.error ?? `http_${res.status}`, data?.field);
  return data;
}

export const EVENT_FIELD_LABEL: Record<string, string> = {
  name: 'Tên sự kiện',
  description: 'Mô tả',
  genre: 'Thể loại',
  imageUrl: 'Ảnh bìa',
  imageCredit: 'Ghi công ảnh',
  city: 'Thành phố',
  startsAt: 'Giờ bắt đầu',
  endsAt: 'Giờ kết thúc',
  salesStartsAt: 'Giờ mở bán',
  salesEndsAt: 'Giờ đóng bán',
  status: 'Trạng thái',
  maxTicketsPerUser: 'Số vé tối đa mỗi tài khoản',
  venueName: 'Tên địa điểm',
  venueAddress: 'Địa chỉ'
};

export function eventSaveMessage(err: unknown): string {
  if (err instanceof EventSaveError) {
    if (err.code === 'invalid_event_field' && err.field) return `${EVENT_FIELD_LABEL[err.field] ?? err.field} không hợp lệ.`;
    if (err.code === 'venue_shared') return 'Địa điểm này dùng chung cho sự kiện khác nên không sửa tên, địa chỉ ở đây được.';
    if (err.code === 'not_event_organizer') return 'Bạn không phải ban tổ chức của sự kiện này.';
    if (err.code === 'unauthorized') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (err.code === 'network_error') return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
  }
  return 'Không thể lưu. Vui lòng thử lại.';
}

export interface ZonePricing {
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
}

export async function apiFetchOrganizerEvents(): Promise<OrganizerEvent[]> {
  const res = await fetch('/api/organizer/events');
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) ?? [];
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
      body: JSON.stringify(pricing),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.error ?? `http_${res.status}`;
  } catch {
    return 'network_error';
  }
}

const PRICING_ERROR_MESSAGES: Record<string, string> = {
  invalid_price_bounds: 'Giá không hợp lệ: cần thỏa mãn 0 ≤ giá sàn ≤ giá cơ bản ≤ giá trần.',
  not_event_organizer: 'Bạn không phải ban tổ chức của sự kiện này.',
  feature_disabled: 'Tính năng cấu hình giá hiện đang tắt.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  network_error: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
};

export function pricingErrorMessage(code: string): string {
  return PRICING_ERROR_MESSAGES[code] ?? 'Không thể lưu giá. Vui lòng thử lại.';
}
