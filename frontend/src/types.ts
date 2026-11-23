export type ZoneKind = 'seated' | 'standing';

export interface TicketTier {
  id: string;
  /** Zone code from the API, e.g. VIP or GA1. */
  code?: string;
  name: string;
  description: string;
  price: number;
  available: number;
  capacity?: number;
  kind?: ZoneKind;
  perks: string[];
}

export interface EventItem {
  id: string;
  slug?: string;
  title: string;
  subTitle?: string;
  imageUrl: string;
  /** Photo attribution required by the image licence. */
  imageCredit?: string;
  bannerUrl?: string;
  date: string;
  time: string;
  rawDate: string; // ISO string for date filtering
  venue: string;
  city: string;
  address: string;
  priceStart: number;
  genre: string;
  isTrending?: boolean;
  isPopular?: boolean;
  ticketTiers: TicketTier[];
  artists: {
    name: string;
    role: string;
    avatar: string;
  }[];
  description: string;
  organizer: {
    name: string;
    verified: boolean;
    contact: string;
  };
  ageRestriction?: string;
  spotifyPlaylistUrl?: string;
  /** Only present once the event detail has loaded. */
  maxTicketsPerUser?: number;
}

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar: string;
  authProvider: 'phone' | 'email';
  role?: UserRole;
  createdAt: string;
}

export type UserRole = 'CUSTOMER' | 'ORGANIZER' | 'CEO' | 'GATE_STAFF' | 'ADMIN';

export interface Booking {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  imageUrl: string;
  tierId: string;
  tierName: string;
  quantity: number;
  totalAmount: number;
  attendeeName: string;
  attendeePhone: string;
  attendeeEmail: string;
  bookingCode: string;
  purchasedAt: string;
  paymentMethod: string;
  status: 'confirmed' | 'cancelled';
  userId?: string;
  /** Seat IDs, used to talk to the API. */
  selectedSeats?: string[];
  /** Human-readable seat labels ("A1"), shown to the user. */
  seatLabels?: string[];
}

export type SeatStatus = 'available' | 'sold' | 'held' | 'selected';

export interface SeatItem {
  id: string;
  label: string;
  zoneId: string;
  zoneCode?: string;
  zoneName: string;
  row: string;
  number: number;
  price: number;
  status: 'available' | 'sold' | 'held' | 'selected';
  tierId: string;
}

export interface SeatZoneConfig {
  id: string;
  name: string;
  colorName: string;
  rows: string[];
  seatsPerRow: number;
  tierId: string;
  price: number;
}

export interface FilterState {
  searchQuery: string;
  startDate: string;
  endDate: string;
  selectedGenres: string[];
  city: string;
  onlyTrending: boolean;
  onlyPopular: boolean;
  priceRange: [number, number];
}
