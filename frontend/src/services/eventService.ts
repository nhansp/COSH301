import { EventItem, SeatItem } from '../types';

export const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';
export const DEFAULT_BANNER_IMAGE = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80';

/**
 * Loads events from the backend only. Seat maps, holds and checkout need the
 * event to exist server-side, so there is no client-side fallback data.
 */
export async function fetchEventsFromAPI(): Promise<EventItem[]> {
  const res = await fetch('/api/events');
  if (!res.ok) throw new Error(`GET /api/events failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('GET /api/events returned an unexpected payload');
  return data.map((ev: any) => {
    const d = ev.date ? new Date(ev.date) : new Date();
    return {
      id: ev.id,
      slug: ev.slug,
      title: ev.title || ev.name,
      subTitle: ev.description || 'Đêm nhạc đặc sắc hội tụ các nghệ sĩ hàng đầu Việt Nam',
      imageUrl: ev.imageUrl || DEFAULT_EVENT_IMAGE,
      bannerUrl: ev.imageUrl || DEFAULT_BANNER_IMAGE,
      date: d.toLocaleDateString('vi-VN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      rawDate: ev.date || d.toISOString(),
      venue: ev.venue || 'Trung tâm Hội nghị Quốc gia',
      city: ev.city || 'Hà Nội',
      address: ev.address || 'Số 57 Phạm Hùng, Mễ Trì, Nam Từ Liêm, Hà Nội',
      priceStart: typeof ev.priceFrom === 'number' ? ev.priceFrom : 0,
      currency: '₫',
      genre: ev.genre || 'Classical & Symphony',
      isTrending: true,
      isPopular: true,
      description: ev.description || 'Đêm nhạc đặc sắc hội tụ các nghệ sĩ hàng đầu Việt Nam, mang đến không gian âm nhạc sống động và đầy cảm xúc.',
      ageRestriction: '16+',
      organizer: {
        name: 'Ban Tổ Chức Mẫu',
        verified: true,
        contact: 'organizer@eventticketing.vn'
      },
      artists: [
        {
          name: 'Dàn nhạc Giao hưởng Quốc gia',
          role: 'Dàn nhạc chính',
          avatar: ev.imageUrl || DEFAULT_EVENT_IMAGE
        }
      ],
      // Zones (tiers) come from the event detail endpoint; see loadEventDetail.
      ticketTiers: []
    };
  });
}

export function formatPrice(amount: number, currency: string = '₹'): string {
  if (amount === 0) return 'Free Onwards';
  if (currency === '₫') {
    return `${amount.toLocaleString('vi-VN')}₫`;
  }
  if (currency === '$') {
    return `$${amount.toLocaleString('en-US')}`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

// -------------------------------------------------------------
// Real Backend API Integrations
// -------------------------------------------------------------

export async function apiFetchEvents(): Promise<EventItem[] | null> {
  try {
    const res = await fetch('/api/events');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Remaining seats per zone, or null when the seat map is unavailable. */
async function countAvailableSeatsByZone(eventId: string): Promise<Map<string, number> | null> {
  const seats = await apiFetchSeats(eventId);
  if (!seats) return null;
  const counts = new Map<string, number>();
  for (const seat of seats) {
    if (seat.status === 'available') counts.set(seat.zoneId, (counts.get(seat.zoneId) ?? 0) + 1);
  }
  return counts;
}

export async function apiFetchEventDetail(identifier: string): Promise<EventItem | null> {
  try {
    const res = await fetch(`/api/events/${identifier}`);
    if (!res.ok) return null;
    const ev = await res.json();
    const zones: any[] = Array.isArray(ev.zones) ? ev.zones : [];
    const availableByZone = await countAvailableSeatsByZone(ev.id);
    const d = ev.startsAt ? new Date(ev.startsAt) : new Date();
    return {
      id: ev.id,
      slug: ev.slug,
      title: ev.name || ev.title,
      subTitle: ev.description || 'Đêm nhạc đặc sắc hội tụ các nghệ sĩ hàng đầu Việt Nam',
      imageUrl: ev.imageUrl || DEFAULT_EVENT_IMAGE,
      bannerUrl: ev.imageUrl || DEFAULT_BANNER_IMAGE,
      date: d.toLocaleDateString('vi-VN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      rawDate: ev.startsAt || d.toISOString(),
      venue: ev.venueName || 'Trung tâm Hội nghị Quốc gia',
      city: ev.city || 'Hà Nội',
      address: ev.venueAddress || 'Số 57 Phạm Hùng, Mễ Trì, Nam Từ Liêm, Hà Nội',
      priceStart: zones.length > 0 ? Math.min(...zones.map((z: any) => z.basePrice)) : 0,
      currency: '₫',
      genre: ev.genre || 'Classical & Symphony',
      isTrending: true,
      isPopular: true,
      description: ev.description || 'Đêm nhạc đặc sắc hội tụ các nghệ sĩ hàng đầu Việt Nam',
      ageRestriction: '16+',
      organizer: {
        name: 'Ban Tổ Chức Mẫu',
        verified: true,
        contact: 'organizer@eventticketing.vn'
      },
      artists: [
        {
          name: 'Dàn nhạc Giao hưởng Quốc gia',
          role: 'Dàn nhạc chính',
          avatar: ev.imageUrl || DEFAULT_EVENT_IMAGE
        }
      ],
      ticketTiers: zones.map((z: any) => ({
        id: z.zoneId,
        name: z.zoneName,
        description: `Khu vực ${z.zoneName} (${z.zoneCode})${z.floor ? ` - ${z.floor}` : ''}`,
        price: z.basePrice,
        available: availableByZone?.get(z.zoneId) ?? z.capacity,
        perks: []
      }))
    };
  } catch {
    return null;
  }
}

export async function apiFetchSeats(eventId: string): Promise<SeatItem[] | null> {
  try {
    const res = await fetch(`/api/events/${eventId}/seats`);
    if (!res.ok) return null;
    const data = await res.json();
    const seats: SeatItem[] = data.map((item: any) => ({
      id: item.seatId || item.label,
      zoneId: item.zoneId,
      zoneName: item.zoneName,
      row: item.row,
      number: parseInt(item.number) || 1,
      price: item.currentPrice,
      status: item.status,
      tierId: item.zoneId,
    }));
    // The API orders labels as text (A1, A10, A2…); keep its zone order but sort seats numerically.
    const zoneOrder = new Map<string, number>();
    seats.forEach(seat => {
      if (!zoneOrder.has(seat.zoneId)) zoneOrder.set(seat.zoneId, zoneOrder.size);
    });
    return seats.sort(
      (a, b) =>
        (zoneOrder.get(a.zoneId) ?? 0) - (zoneOrder.get(b.zoneId) ?? 0) ||
        a.row.localeCompare(b.row, undefined, { numeric: true }) ||
        a.number - b.number
    );
  } catch {
    return null;
  }
}

export async function apiHoldSeat(eventId: string, seatId: string): Promise<{ success: boolean; expiresAt?: string; error?: string }> {
  try {
    const res = await fetch('/api/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, seatId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || 'hold_failed' };
    }
    return { success: true, expiresAt: data.expiresAt };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function apiReleaseSeat(eventId: string, seatId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/holds/${encodeURIComponent(seatId)}?eventId=${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}


