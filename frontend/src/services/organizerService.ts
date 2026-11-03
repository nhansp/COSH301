export interface OrganizerEvent {
  id: string;
  name: string;
  slug: string;
  status: string;
  startsAt: string;
  imageUrl?: string;
  venueName?: string;
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
  floor?: string;
  capacity: number;
  isDynamicPricingEnabled: boolean;
}

export async function apiFetchOrganizerEvents(): Promise<OrganizerEvent[]> {
  const res = await fetch('/api/organizer/events');
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) ?? [];
}

export async function apiFetchEventZones(eventId: string): Promise<OrganizerZone[]> {
  const res = await fetch(`/api/events/${eventId}`);
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
