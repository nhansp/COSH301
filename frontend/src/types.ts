export type ZoneKind = 'seated' | 'standing';

export type StageShape = 'standard' | 'thrust' | 'catwalk' | 'center';
export type LayoutStyle = 'horseshoe' | 'theater' | 'amphitheater' | 'arena360';
export type StageTheme = 'electric' | 'sunset' | 'emerald' | 'gold';

export interface ZoneStyleConfig {
  color?: string;
  rows?: number;
  seatsPerRow?: number;
}

export interface StageLayoutConfig {
  stageShape?: StageShape;
  layoutStyle?: LayoutStyle;
  stageTheme?: StageTheme;
  stageLabel?: string;
  stageWidth?: number;
  stageDepth?: number;
  stageHeight?: number;
  catwalkLength?: number;
  catwalkWidth?: number;
  tierSpanDeg?: number;
  zonesPerRing?: number;
  pitWidth?: number;
  pitDepth?: number;
  zoneStyles?: Record<string, ZoneStyleConfig>;
}

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
  ticketTiers: TicketTier[];
  description: string;
  layoutConfig?: StageLayoutConfig;
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

/** A seat the signed-in user is currently holding, as reported by GET /api/holds. */
export interface Hold {
  eventId: string;
  eventSlug: string;
  eventName: string;
  startsAt: string;
  venueName: string;
  seatId: string;
  seatLabel: string;
  zoneName: string;
  price: number;
  expiresAt: string;
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

export interface FilterState {
  searchQuery: string;
  startDate: string;
  endDate: string;
  selectedGenres: string[];
  city: string;
}
