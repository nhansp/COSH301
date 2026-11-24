import { Hold, SeatItem } from '../types';

const STORAGE_KEY = 'sms_organizer_test_cart_v1';

export interface OrganizerTestCart {
  eventId: string;
  eventSlug: string;
  eventName: string;
  startsAt: string;
  venueName: string;
  seats: SeatItem[];
  expiresAt: string;
}

function readAll(): Record<string, OrganizerTestCart> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, OrganizerTestCart>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors in private browsing.
  }
}

export function loadOrganizerTestCart(eventKey: string): OrganizerTestCart | null {
  const all = readAll();
  const direct = all[eventKey];
  if (direct && Date.parse(direct.expiresAt) > Date.now() && direct.seats.length > 0) {
    return direct;
  }
  const bySlug = Object.values(all).find(
    c => (c.eventId === eventKey || c.eventSlug === eventKey) && Date.parse(c.expiresAt) > Date.now() && c.seats.length > 0
  );
  return bySlug ?? null;
}

export function saveOrganizerTestCart(cart: OrganizerTestCart) {
  const all = readAll();
  if (cart.seats.length === 0) {
    delete all[cart.eventId];
  } else {
    all[cart.eventId] = cart;
  }
  writeAll(all);
}

export function clearOrganizerTestCart(eventId: string) {
  const all = readAll();
  delete all[eventId];
  writeAll(all);
}

export function testCartToHolds(cart: OrganizerTestCart): Hold[] {
  return cart.seats.map(seat => ({
    eventId: cart.eventId,
    eventSlug: cart.eventSlug,
    eventName: cart.eventName,
    startsAt: cart.startsAt,
    venueName: cart.venueName,
    seatId: seat.id,
    seatLabel: seat.label,
    zoneName: seat.zoneName,
    price: seat.price,
    expiresAt: cart.expiresAt
  }));
}
