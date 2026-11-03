export interface TicketTier {
  id: string;
  name: string;
  description: string;
  price: number;
  available: number;
  perks: string[];
}

export interface EventItem {
  id: string;
  slug?: string;
  title: string;
  subTitle?: string;
  imageUrl: string;
  bannerUrl?: string;
  date: string;
  time: string;
  rawDate: string; // ISO string for date filtering
  venue: string;
  city: string;
  address: string;
  priceStart: number;
  currency: string;
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
  currency: string;
  attendeeName: string;
  attendeePhone: string;
  attendeeEmail: string;
  bookingCode: string;
  purchasedAt: string;
  paymentMethod: string;
  status: 'confirmed' | 'cancelled';
  selectedSeats?: string[];
}

export interface CancelledTicket {
  id: number | string;
  bookingId: string;
  bookingCode: string;
  eventId: string;
  eventTitle: string;
  concert?: {
    id?: string;
    name?: string;
    title?: string;
    slug?: string;
    genre?: string;
    venue?: string;
    venueAddress?: string;
    city?: string;
    date?: string;
    time?: string;
    imageUrl?: string;
    startsAt?: string;
    endsAt?: string;
  };
  ticketDetails?: {
    eventTitle?: string;
    eventDate?: string;
    eventTime?: string;
    venue?: string;
    city?: string;
    tierName?: string;
    tierId?: string;
    quantity?: number;
    totalAmount?: number;
    currency?: string;
    attendeeName?: string;
    attendeeEmail?: string;
    attendeePhone?: string;
    paymentMethod?: string;
    purchasedAt?: string;
  };
  seats?: string[];
  reason: string;
  cancelledAt: string;
  userEmail?: string;
}

export type SeatStatus = 'available' | 'sold' | 'held' | 'selected';

export interface SeatItem {
  id: string;
  zoneId: string;
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
