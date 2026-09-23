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
  createdAt: string;
}

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
  qrCodeUrl: string;
  purchasedAt: string;
  paymentMethod: string;
  status: 'confirmed' | 'cancelled';
  selectedSeats?: string[];
}

export type SeatStatus = 'available' | 'sold' | 'held' | 'selected';

export interface SeatItem {
  id: string;
  zoneId: string;
  zoneName: string;
  row: string;
  number: number;
  price: number;
  status: 'available' | 'sold' | 'held';
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
