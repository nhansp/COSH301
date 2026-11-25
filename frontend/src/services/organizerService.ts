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

export interface OrganizerCancellationRecord {
  id: number;
  eventId: string;
  eventName: string;
  bookingCode: string;
  customerEmail: string;
  seatLabels: string[];
  seatIds: string[];
  seatCount: number;
  tierId?: string;
  tierName?: string;
  totalAmount?: number;
  reason: string;
  cancelledAt: string;
}

export interface ZoneCancellationEntry {
  record: OrganizerCancellationRecord;
  seatLabels: string[];
  seatCount: number;
}

export interface ZoneCancellationStats {
  cancelledSeats: number;
  cancelCount: number;
  entries: ZoneCancellationEntry[];
}

export function groupCancellationsByZone(
  cancellations: OrganizerCancellationRecord[],
  seats: { id: string; label: string; zoneId: string }[],
  zones: { zoneId: string; zoneCode: string; zoneName: string }[]
): Map<string, ZoneCancellationStats> {
  const result = new Map<string, ZoneCancellationStats>();
  const seatById = new Map(seats.map(s => [s.id, s]));
  const zoneIds = new Set(zones.map(z => z.zoneId));

  const addEntry = (zoneId: string, record: OrganizerCancellationRecord, labels: string[], count: number) => {
    const existing = result.get(zoneId) ?? { cancelledSeats: 0, cancelCount: 0, entries: [] };
    existing.cancelledSeats += count;
    existing.cancelCount += 1;
    existing.entries.push({ record, seatLabels: labels, seatCount: count });
    result.set(zoneId, existing);
  };

  for (const rec of cancellations) {
    const matchedByZone = new Map<string, string[]>();
    for (const sid of rec.seatIds) {
      const seat = seatById.get(sid);
      if (!seat) continue;
      const list = matchedByZone.get(seat.zoneId) ?? [];
      list.push(seat.label);
      matchedByZone.set(seat.zoneId, list);
    }

    if (matchedByZone.size > 0) {
      for (const [zoneId, labels] of matchedByZone.entries()) {
        const displayLabels =
          matchedByZone.size === 1 && rec.seatLabels.length > 0 ? rec.seatLabels : labels;
        addEntry(zoneId, rec, displayLabels, Math.max(labels.length, displayLabels.length));
      }
      continue;
    }

    // Fallback: match by tierId, then tierName/zoneCode, then unique seat label.
    let fallbackZoneId: string | undefined;
    if (rec.tierId && zoneIds.has(rec.tierId)) {
      fallbackZoneId = rec.tierId;
    } else if (rec.tierName) {
      const needle = rec.tierName.trim().toLowerCase();
      fallbackZoneId = zones.find(
        z => z.zoneName.trim().toLowerCase() === needle || z.zoneCode.trim().toLowerCase() === needle
      )?.zoneId;
    } else if (rec.seatLabels.length > 0) {
      const candidates = new Set<string>();
      for (const lbl of rec.seatLabels) {
        const matching = seats.filter(s => s.label === lbl);
        if (matching.length === 1) candidates.add(matching[0].zoneId);
      }
      if (candidates.size === 1) fallbackZoneId = [...candidates][0];
    }

    if (fallbackZoneId) {
      addEntry(fallbackZoneId, rec, rec.seatLabels, rec.seatCount);
    }
  }

  return result;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export async function apiFetchOrganizerCancellations(): Promise<OrganizerCancellationRecord[]> {
  try {
    const res = await fetch('/api/tickets/audit-logs', { credentials: 'include' });
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];

    const records: OrganizerCancellationRecord[] = [];
    for (const entry of raw) {
      const item = asRecord(entry);
      if (!item || item.action !== 'TICKET_CANCELLED') continue;

      const oldData = asRecord(item.oldData);
      const concert = asRecord(item.concert) ?? asRecord(oldData?.concert);
      const client = asRecord(oldData?.client);
      const clientConcert = asRecord(client?.concert);
      const ticketDetails = asRecord(client?.ticketDetails) ?? asRecord(oldData?.ticketDetails);

      const releasedSeats = stringArray(oldData?.releasedSeats);
      const rawSeats = stringArray(oldData?.seats);
      const seatLabels =
        releasedSeats.length > 0
          ? releasedSeats
          : rawSeats.filter(ref => !UUID_PATTERN.test(ref));
      const seatIds = rawSeats.filter(ref => UUID_PATTERN.test(ref));

      const detailQty =
        typeof ticketDetails?.quantity === 'number' && ticketDetails.quantity > 0
          ? ticketDetails.quantity
          : 0;
      const seatCount = Math.max(1, seatLabels.length, rawSeats.length, detailQty);

      const actorEmail = firstNonEmpty(item.actorEmail);
      const customerEmail =
        actorEmail && actorEmail !== 'guest'
          ? actorEmail
          : firstNonEmpty(oldData?.userEmail, ticketDetails?.attendeeEmail, 'Khách hàng');

      const eventId = firstNonEmpty(oldData?.eventId, concert?.id, clientConcert?.id);
      const eventName = firstNonEmpty(
        item.eventName,
        concert?.name,
        concert?.title,
        clientConcert?.name,
        clientConcert?.title,
        ticketDetails?.eventTitle,
        'Sự kiện'
      );

      const totalAmount =
        typeof ticketDetails?.totalAmount === 'number' && ticketDetails.totalAmount > 0
          ? ticketDetails.totalAmount
          : undefined;
      const tierId = firstNonEmpty(ticketDetails?.tierId) || undefined;
      const tierName = firstNonEmpty(ticketDetails?.tierName) || undefined;

      records.push({
        id: typeof item.id === 'number' ? item.id : records.length + 1,
        eventId,
        eventName,
        bookingCode: firstNonEmpty(oldData?.bookingCode),
        customerEmail,
        seatLabels,
        seatIds,
        seatCount,
        tierId,
        tierName,
        totalAmount,
        reason: firstNonEmpty(item.reason, 'Khách hàng xác nhận hủy vé'),
        cancelledAt: firstNonEmpty(item.createdAt)
      });
    }
    return records;
  } catch {
    return [];
  }
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
