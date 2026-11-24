import { EventItem, SeatItem, TicketTier, UserRole, ZoneKind } from '../types';
import { apiFetchSeats, formatPrice, formatPriceShort } from './eventService';
import { EventSalesSummary, OrganizerZone, apiFetchEventSalesSummary } from './organizerService';
import { ZoneSummary, summarizeZones, zoneKindOf } from './venue';

export type AssistantLang = 'vi' | 'en';
export type StageGraphTab = 'map' | 'pricing' | 'capacity';
export type StageMapOverlay = 'price' | 'occupancy';

export interface UserPreferences {
  genre?: string;
  city?: string;
  maxBudget?: number;
  minBudget?: number;
  seating?: ZoneKind;
  keyword?: string;
}

export interface ZoneTelemetry {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  floor?: string;
  kind: ZoneKind;
  capacity: number;
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  isDynamicPricingEnabled: boolean;
  totalSeats: number;
  available: number;
  held: number;
  sold: number;
  occupancyRate: number;
  potentialRevenue: number;
  activeRevenue: number;
}

export interface EnrichedEvent {
  event: EventItem;
  zones: ZoneTelemetry[];
  zoneSummaries: ZoneSummary[];
  seats: SeatItem[];
  totalSeats: number;
  availableSeats: number;
  heldSeats: number;
  soldSeats: number;
  occupancyRate: number;
  minPrice: number;
  maxPrice: number;
  potentialRevenue: number;
  activeRevenue: number;
  trendingScore: number;
}

export interface RecommendedEvent {
  enriched: EnrichedEvent;
  score: number;
  reasons: string[];
}

export type AssistantPayload =
  | { kind: 'brief'; events: EnrichedEvent[]; focusSingle: boolean }
  | { kind: 'trending'; events: EnrichedEvent[] }
  | { kind: 'recommendations'; items: RecommendedEvent[]; preferences: UserPreferences }
  | { kind: 'preference_picker'; initial: UserPreferences; genres: string[]; cities: string[] }
  | {
      kind: 'sales_analysis';
      eventId: string;
      events: EnrichedEvent[];
      serverSummary?: EventSalesSummary | null;
    }
  | {
      kind: 'stage_graph';
      eventId: string;
      events: EnrichedEvent[];
      initialTab: StageGraphTab;
      initialOverlay: StageMapOverlay;
    };

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  payload?: AssistantPayload;
  suggestions?: string[];
  timestamp: number;
}

export interface OpenAssistantDetail {
  prompt?: string;
  eventId?: string;
  mode?: 'stage_graph' | 'sales_analysis';
  stageTab?: StageGraphTab;
  stageOverlay?: StageMapOverlay;
}

export const OPEN_ASSISTANT_EVENT = 'sortmyscene:open-assistant';

export function openAssistant(detail: OpenAssistantDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenAssistantDetail>(OPEN_ASSISTANT_EVENT, { detail }));
}

// ---------------------------------------------------------------------------
// Text normalization & language helpers
// ---------------------------------------------------------------------------

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function detectLanguage(input: string): AssistantLang {
  const raw = input.trim();
  if (!raw) return 'vi';
  // Vietnamese diacritics are a definitive signal.
  if (/[ăâêôơưđàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(raw)) return 'vi';
  const norm = normalizeText(raw);
  const viHints = [
    'su kien',
    'tom tat',
    'goi y',
    'san khau',
    'bieu do',
    'so do',
    'khu vuc',
    'trieu',
    'duoi',
    'cho toi',
    'minh',
    'nao',
    'dang hot',
    'gia ve',
    'ghe',
    'dung',
    'ngoi',
    've ',
    'ha noi',
    'sai gon',
    'ban to chuc',
    'doanh thu',
    'lap day'
  ];
  if (viHints.some(h => norm.includes(h))) return 'vi';

  const enHints = [
    'brief',
    'summary',
    'summarize',
    'overview',
    'trending',
    'popular',
    'recommend',
    'suggest',
    'preference',
    'stage',
    'graph',
    'visual',
    'chart',
    'heatmap',
    'layout',
    'pricing',
    'capacity',
    'revenue',
    'event',
    'concert',
    'under',
    'budget',
    'cheap',
    'standing',
    'seated',
    'which',
    'what',
    'show me',
    'hello',
    'hi'
  ];
  if (enHints.some(h => norm.includes(h))) return 'en';
  return 'vi';
}

// ---------------------------------------------------------------------------
// Live PostgreSQL telemetry fetching with short TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  fetchedAt: number;
  data: EnrichedEvent[];
}

const CACHE_TTL_MS = 30_000;
let telemetryCache: CacheEntry | null = null;

export function invalidateAssistantCache() {
  telemetryCache = null;
}

async function fetchRawEventDetail(eventId: string): Promise<{ zones: OrganizerZone[]; maxTicketsPerUser?: number } | null> {
  try {
    const res = await fetch(`/api/events/${eventId}`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      zones: Array.isArray(data.zones) ? data.zones : [],
      maxTicketsPerUser: typeof data.maxTicketsPerUser === 'number' ? data.maxTicketsPerUser : undefined
    };
  } catch {
    return null;
  }
}

function buildEnrichedEvent(event: EventItem, rawZones: OrganizerZone[], seats: SeatItem[]): EnrichedEvent {
  const seatsByZone = new Map<string, SeatItem[]>();
  for (const s of seats) {
    const list = seatsByZone.get(s.zoneId);
    if (list) list.push(s);
    else seatsByZone.set(s.zoneId, [s]);
  }

  const zones: ZoneTelemetry[] = rawZones
    .map(z => {
      const zSeats = seatsByZone.get(z.zoneId) ?? [];
      const available = zSeats.length > 0 ? zSeats.filter(s => s.status === 'available').length : z.capacity;
      const held = zSeats.filter(s => s.status === 'held' || s.status === 'selected').length;
      const sold = zSeats.filter(s => s.status === 'sold').length;
      const totalSeats = zSeats.length > 0 ? zSeats.length : z.capacity;
      const occupancyRate = totalSeats > 0 ? (sold + held) / totalSeats : 0;
      const potentialRevenue = totalSeats * z.basePrice;
      const activeRevenue = (sold + held) * z.basePrice;
      return {
        zoneId: z.zoneId,
        zoneCode: z.zoneCode,
        zoneName: z.zoneName,
        floor: z.floor,
        kind: zoneKindOf(z.zoneName || ''),
        capacity: z.capacity,
        basePrice: z.basePrice,
        floorPrice: z.floorPrice,
        ceilingPrice: z.ceilingPrice,
        isDynamicPricingEnabled: z.isDynamicPricingEnabled,
        totalSeats,
        available,
        held,
        sold,
        occupancyRate,
        potentialRevenue,
        activeRevenue
      };
    })
    .sort((a, b) => b.basePrice - a.basePrice);

  const tiers: TicketTier[] = zones.map(z => ({
    id: z.zoneId,
    code: z.zoneCode,
    name: z.zoneName,
    kind: z.kind,
    capacity: z.capacity,
    description: `Khu vực ${z.zoneName} (${z.zoneCode})`,
    price: z.basePrice,
    available: z.available,
    perks: []
  }));

  const zoneSummaries = summarizeZones(tiers, seats);
  const totalSeats = zones.reduce((sum, z) => sum + z.totalSeats, 0);
  const availableSeats = zones.reduce((sum, z) => sum + z.available, 0);
  const heldSeats = zones.reduce((sum, z) => sum + z.held, 0);
  const soldSeats = zones.reduce((sum, z) => sum + z.sold, 0);
  const occupancyRate = totalSeats > 0 ? (soldSeats + heldSeats) / totalSeats : 0;
  const minPrice = zones.length > 0 ? Math.min(...zones.map(z => z.basePrice)) : event.priceStart;
  const maxPrice = zones.length > 0 ? Math.max(...zones.map(z => z.basePrice)) : event.priceStart;
  const potentialRevenue = zones.reduce((sum, z) => sum + z.potentialRevenue, 0);
  const activeRevenue = zones.reduce((sum, z) => sum + z.activeRevenue, 0);

  // Trending score combines live demand (occupancy), production scale (zones), and recency.
  const eventTime = Date.parse(event.rawDate) || 0;
  const yearScore = Math.max(0, Math.min(22, ((new Date(eventTime).getUTCFullYear() - 2022) / 4) * 22));
  const scaleScore = Math.min(20, zones.length * 1.8);
  const demandScore = occupancyRate * 58;
  const trendingScore = Math.round((demandScore + scaleScore + yearScore) * 10) / 10;

  return {
    event: { ...event, ticketTiers: tiers.length > 0 ? tiers : event.ticketTiers },
    zones,
    zoneSummaries,
    seats,
    totalSeats,
    availableSeats,
    heldSeats,
    soldSeats,
    occupancyRate,
    minPrice,
    maxPrice,
    potentialRevenue,
    activeRevenue,
    trendingScore
  };
}

export async function fetchEnrichedEvents(baseEvents: EventItem[], force = false): Promise<EnrichedEvent[]> {
  if (!force && telemetryCache && Date.now() - telemetryCache.fetchedAt < CACHE_TTL_MS && telemetryCache.data.length === baseEvents.length) {
    return telemetryCache.data;
  }

  const enriched = await Promise.all(
    baseEvents.map(async ev => {
      const [detail, seats] = await Promise.all([fetchRawEventDetail(ev.id), apiFetchSeats(ev.id)]);
      return buildEnrichedEvent(ev, detail?.zones ?? [], seats ?? []);
    })
  );

  telemetryCache = { fetchedAt: Date.now(), data: enriched };
  return enriched;
}

// ---------------------------------------------------------------------------
// Preference extraction & event matching
// ---------------------------------------------------------------------------

function extractBudgetVnd(norm: string): { minBudget?: number; maxBudget?: number } {
  // Match numbers like "1tr", "1.5 tr", "1,5 trieu", "1.5m", "800k", "500000"
  const match = norm.match(/(\d+(?:[.,]\d+)?)\s*(tr(?:ieu)?|m|k|ngh[i]n|vnd|d)?\b/);
  const hasUnder = /(duoi|under|below|max|toi da|<=|<|it hon|re hon|tam|khoang)/.test(norm);
  const hasOver = /(tren|over|above|min|tu|>=|>|cao cap)/.test(norm);

  if (match) {
    const rawNum = parseFloat(match[1].replace(',', '.'));
    const unit = match[2] || '';
    let value: number | null = null;
    if (unit.startsWith('tr') || unit === 'm') value = Math.round(rawNum * 1_000_000);
    else if (unit === 'k' || unit.startsWith('ngh')) value = Math.round(rawNum * 1_000);
    else if (rawNum >= 100_000) value = Math.round(rawNum);

    if (value !== null) {
      if (hasOver && !hasUnder) return { minBudget: value };
      return { maxBudget: value };
    }
  }

  if (/(re|tiet kiem|budget|cheap|affordable|gia mem|sinh vien)/.test(norm)) {
    return { maxBudget: 1_000_000 };
  }
  if (/(vip|platinum|cao cap|luxury|premium|hang sang)/.test(norm)) {
    return { minBudget: 5_000_000 };
  }
  return {};
}

export function extractPreferences(input: string, events: EnrichedEvent[]): UserPreferences {
  const norm = normalizeText(input);
  const prefs: UserPreferences = {};

  // Genre detection from actual DB genres + aliases
  const genres = Array.from(new Set(events.map(e => e.event.genre).filter(Boolean)));
  for (const g of genres) {
    const gn = normalizeText(g);
    const compact = gn.replace(/[^a-z0-9]/g, '');
    if (norm.includes(gn) || (compact.length >= 3 && norm.replace(/[^a-z0-9]/g, '').includes(compact))) {
      prefs.genre = g;
      break;
    }
  }
  if (!prefs.genre) {
    if (/(han quoc|korean|idol|blackpink|g-dragon|gdragon)/.test(norm)) {
      prefs.genre = genres.find(g => normalizeText(g).includes('k-pop')) ?? 'K-pop';
    } else if (/(viet|nhac viet|vpop|my tam|anh trai|ballad)/.test(norm)) {
      prefs.genre = genres.find(g => normalizeText(g).includes('v-pop')) ?? 'V-pop';
    }
  }

  // City detection from actual DB cities + aliases
  const cities = Array.from(new Set(events.map(e => e.event.city).filter(Boolean)));
  for (const c of cities) {
    const cn = normalizeText(c);
    if (norm.includes(cn)) {
      prefs.city = c;
      break;
    }
  }
  if (!prefs.city) {
    if (/(ha noi|hanoi|my dinh|\bhn\b)/.test(norm)) {
      prefs.city = cities.find(c => normalizeText(c).includes('ha noi'));
    } else if (/(tp\.?\s*hcm|hcm|ho chi minh|sai gon|saigon|van phuc|thu duc)/.test(norm)) {
      prefs.city = cities.find(c => normalizeText(c).includes('ho chi minh'));
    } else if (/(hung yen|ocean park|ocean city|van giang)/.test(norm)) {
      prefs.city = cities.find(c => normalizeText(c).includes('hung yen'));
    }
  }

  // Seating style
  if (/(dung|standing|fanzone|quay|pit)/.test(norm)) {
    prefs.seating = 'standing';
  } else if (/(ngoi|seated|seat|chill|khan dai|thoai mai)/.test(norm)) {
    prefs.seating = 'seated';
  }

  const budget = extractBudgetVnd(norm);
  if (budget.maxBudget !== undefined) prefs.maxBudget = budget.maxBudget;
  if (budget.minBudget !== undefined) prefs.minBudget = budget.minBudget;

  return prefs;
}

export function matchEventFromQuery(input: string, events: EnrichedEvent[], currentEventId?: string): EnrichedEvent | undefined {
  const norm = normalizeText(input);
  if (/(nay|this event|this concert|this show|hien tai|dang xem)/.test(norm) && currentEventId) {
    const active = events.find(e => e.event.id === currentEventId || e.event.slug === currentEventId);
    if (active) return active;
  }

  // Specific artist / tour keywords for crisp disambiguation
  const aliases: { pattern: RegExp; match: (e: EventItem) => boolean }[] = [
    { pattern: /(blackpink|born pink)/, match: e => normalizeText(e.title).includes('blackpink') },
    { pattern: /(my tam|see the light)/, match: e => normalizeText(e.title).includes('my tam') },
    { pattern: /(g-?dragon|k-?star|vpbank|dpr ian|triples|\bcl\b)/, match: e => normalizeText(e.title).includes('g-dragon') },
    { pattern: /(chong gai|vuot ngan|ocean park|hung yen)/, match: e => normalizeText(e.title).includes('chong gai') },
    {
      pattern: /(say hi).*(hcm|tp|ho chi minh|sai gon|dem 9|van phuc)|(dem 9|van phuc)/,
      match: e => normalizeText(e.title).includes('say hi') && normalizeText(e.city).includes('ho chi minh')
    },
    {
      pattern: /(say hi).*(ha noi|hanoi|my dinh)/,
      match: e => normalizeText(e.title).includes('say hi') && normalizeText(e.city).includes('ha noi')
    },
    { pattern: /(say hi)/, match: e => normalizeText(e.title).includes('say hi') }
  ];

  for (const rule of aliases) {
    if (rule.pattern.test(norm)) {
      const found = events.find(e => rule.match(e.event));
      if (found) return found;
    }
  }

  // Fallback token overlap against event title & venue
  let best: { item: EnrichedEvent; hits: number } | null = null;
  const tokens = norm.split(/\s+/).filter(t => t.length >= 3);
  for (const item of events) {
    const haystack = normalizeText(`${item.event.title} ${item.event.venue} ${item.event.slug ?? ''}`);
    const hits = tokens.filter(t => haystack.includes(t)).length;
    if (hits >= 2 && (!best || hits > best.hits)) {
      best = { item, hits };
    }
  }
  return best?.item;
}

export function recommendByPreferences(
  events: EnrichedEvent[],
  prefs: UserPreferences,
  lang: AssistantLang
): RecommendedEvent[] {
  const scored = events.map(item => {
    let score = 40 + item.trendingScore * 0.25;
    const reasons: string[] = [];

    if (prefs.genre) {
      if (normalizeText(item.event.genre) === normalizeText(prefs.genre)) {
        score += 32;
        reasons.push(lang === 'en' ? `Matches ${item.event.genre}` : `Đúng gu ${item.event.genre}`);
      } else {
        score -= 12;
      }
    }

    if (prefs.city) {
      if (normalizeText(item.event.city) === normalizeText(prefs.city)) {
        score += 28;
        reasons.push(lang === 'en' ? `In ${item.event.city}` : `Tổ chức tại ${item.event.city}`);
      } else {
        score -= 10;
      }
    }

    if (prefs.maxBudget !== undefined) {
      if (item.minPrice <= prefs.maxBudget) {
        score += 24;
        reasons.push(
          lang === 'en'
            ? `Starts at ${formatPrice(item.minPrice)} (within budget)`
            : `Giá từ ${formatPrice(item.minPrice)} (hợp ngân sách)`
        );
      } else {
        score -= 22;
      }
    }

    if (prefs.minBudget !== undefined) {
      if (item.maxPrice >= prefs.minBudget) {
        score += 20;
        reasons.push(
          lang === 'en'
            ? `Premium tiers up to ${formatPrice(item.maxPrice)}`
            : `Có hạng VIP tới ${formatPrice(item.maxPrice)}`
        );
      } else {
        score -= 10;
      }
    }

    if (prefs.seating) {
      const hasKind = item.zones.some(z => z.kind === prefs.seating && z.available > 0);
      if (hasKind) {
        score += 16;
        reasons.push(
          prefs.seating === 'standing'
            ? lang === 'en'
              ? 'Standing pit available'
              : 'Có khu đứng sôi động'
            : lang === 'en'
              ? 'Seated tiers available'
              : 'Có khán đài ghế ngồi'
        );
      } else {
        score -= 10;
      }
    }

    if (reasons.length === 0) {
      reasons.push(
        lang === 'en'
          ? `${item.event.genre} · ${item.event.city} · from ${formatPriceShort(item.minPrice)}`
          : `${item.event.genre} · ${item.event.city} · từ ${formatPriceShort(item.minPrice)}`
      );
    }

    return {
      enriched: item,
      score: Math.max(10, Math.min(99, Math.round(score))),
      reasons
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Main assistant response generator
// ---------------------------------------------------------------------------

export interface AssistantContext {
  events: EventItem[];
  role?: UserRole;
  currentEventId?: string;
}

async function requestServerLlmProse(
  message: string,
  lang: AssistantLang,
  intent: string,
  currentEventId?: string,
  targetEventId?: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message,
        lang,
        intent,
        currentEventId,
        targetEventId
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.usedLlm && typeof data.text === 'string' && data.text.trim()) {
      return data.text.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateAssistantReply(
  userInput: string,
  ctx: AssistantContext,
  override?: {
    preferences?: UserPreferences;
    stageEventId?: string;
    salesEventId?: string;
    stageTab?: StageGraphTab;
    stageOverlay?: StageMapOverlay;
  }
): Promise<Omit<ChatMessage, 'id' | 'timestamp'>> {
  const lang = detectLanguage(userInput);
  const norm = normalizeText(userInput);
  const isOrganizer = ctx.role === 'ORGANIZER' || ctx.role === 'ADMIN';

  if (ctx.events.length === 0) {
    return {
      sender: 'assistant',
      text:
        lang === 'en'
          ? 'No events are loaded from the database yet. Please refresh the page once the backend is ready.'
          : 'Hiện chưa tải được danh sách sự kiện từ cơ sở dữ liệu. Hãy tải lại trang sau khi máy chủ sẵn sàng.'
    };
  }

  const enriched = await fetchEnrichedEvents(ctx.events);
  const genres = Array.from(new Set(enriched.map(e => e.event.genre))).sort();
  const cities = Array.from(new Set(enriched.map(e => e.event.city))).sort();

  const attachOptionalLlm = async (
    reply: Omit<ChatMessage, 'id' | 'timestamp'>,
    intent: string,
    targetEventId?: string
  ) => {
    const llmText = await requestServerLlmProse(userInput, lang, intent, ctx.currentEventId, targetEventId);
    return llmText ? { ...reply, text: llmText } : reply;
  };

  // Direct sales analysis trigger (e.g. from Organizer Console button)
  if (override?.salesEventId) {
    const target = enriched.find(e => e.event.id === override.salesEventId) ?? enriched[0];
    const reply = await buildSalesAnalysisReply(target, enriched, lang);
    return attachOptionalLlm(reply, 'sales_analysis', target.event.id);
  }

  // Direct stage graph trigger (e.g. from Organizer Console button or SalesBriefCard)
  if (override?.stageEventId) {
    const target = enriched.find(e => e.event.id === override.stageEventId) ?? enriched[0];
    const reply = buildStageGraphReply(target, enriched, lang, override.stageTab ?? 'map', override.stageOverlay ?? 'price');
    return attachOptionalLlm(reply, 'stage_graph', target.event.id);
  }

  // Direct preference submission from inline PreferencePickerCard
  if (override?.preferences) {
    return buildRecommendationReply(enriched, override.preferences, lang);
  }

  // 1. Organizer Sales Analysis intent
  const asksSalesAnalysis =
    /(sales|revenue|doanh thu|ban ve|bao cao|fill rate|hieu suat|thong ke|ti le ban|ty le ban|phan tich ban|sales brief|sales analysis)/.test(
      norm
    );
  const asksStageGraph =
    /(stage|san khau|so do|bieu do|graph|visual|heatmap|nhiet|capacity|suc chua|pricing chart|khung gia|floor plan|zone map|phan tich khu)/.test(
      norm
    );

  if (asksSalesAnalysis && !asksStageGraph) {
    const matched = matchEventFromQuery(userInput, enriched, ctx.currentEventId) ?? enriched[0];
    if (!isOrganizer) {
      return {
        sender: 'assistant',
        text:
          lang === 'en'
            ? `Sales analytics and revenue breakdowns are restricted to the **Organizer** role. Sign in with an Organizer account to unlock sales analysis and stage graphs, or browse the public brief for **${matched.event.title}** below.`
            : `Phân tích doanh thu và hiệu suất bán vé chỉ dành cho vai trò **Ban Tổ Chức**. Hãy đăng nhập bằng tài khoản Ban Tổ Chức để mở tính năng này, hoặc xem tóm tắt công khai của **${matched.event.title}** bên dưới.`,
        payload: { kind: 'brief', events: [matched], focusSingle: true },
        suggestions:
          lang === 'en'
            ? ['Trending events', 'Recommend by preference', 'Brief all events']
            : ['Sự kiện đang hot', 'Gợi ý theo sở thích', 'Tóm tắt lịch diễn']
      };
    }
    const reply = await buildSalesAnalysisReply(matched, enriched, lang);
    return attachOptionalLlm(reply, 'sales_analysis', matched.event.id);
  }

  // 2. Organizer Stage Graph Visualization intent
  if (asksStageGraph) {
    const matched = matchEventFromQuery(userInput, enriched, ctx.currentEventId) ?? enriched[0];
    if (!isOrganizer) {
      return {
        sender: 'assistant',
        text:
          lang === 'en'
            ? `Stage graph analytics (topology, occupancy heatmap & pricing bands) are tailored for the Organizer role. Sign in with an Organizer account to unlock stage graphs, or preview the live audience seat map for "${matched.event.title}" below.`
            : `Công cụ trực quan hoá biểu đồ sân khấu (sơ đồ khu vực, bản đồ nhiệt lấp đầy & khung giá) dành riêng cho vai trò **Ban Tổ Chức**. Hãy đăng nhập bằng tài khoản Ban Tổ Chức để mở biểu đồ này, hoặc xem tóm tắt sự kiện "${matched.event.title}" bên dưới.`,
        payload: { kind: 'brief', events: [matched], focusSingle: true },
        suggestions:
          lang === 'en'
            ? ['Trending events', 'Recommend by preference', 'Brief all events']
            : ['Sự kiện đang hot', 'Gợi ý theo sở thích', 'Tóm tắt tất cả sự kiện']
      };
    }

    let tab: StageGraphTab = 'map';
    let overlay: StageMapOverlay = 'price';
    if (/(khung gia|pricing|price|gia san|gia tran|bien gia|so sanh gia)/.test(norm)) {
      tab = 'pricing';
    } else if (/(capacity|suc chua|ty le|ti le|bar|cot)/.test(norm)) {
      tab = 'capacity';
    } else if (/(heatmap|nhiet|lap day|occupancy|hot zone)/.test(norm)) {
      tab = 'map';
      overlay = 'occupancy';
    }

    const reply = buildStageGraphReply(matched, enriched, lang, tab, overlay);
    return attachOptionalLlm(reply, 'stage_graph', matched.event.id);
  }

  // 2. Trending intent
  const asksTrending = /(trending|hot|pho bien|ban chay|noi bat|top|best|popular|nhieu nguoi|soi dong)/.test(norm);
  if (asksTrending) {
    const ranked = [...enriched].sort((a, b) => b.trendingScore - a.trendingScore);
    const top = ranked[0];
    return {
      sender: 'assistant',
      text:
        lang === 'en'
          ? `Here are the top trending concerts right now based on live seat demand, production scale, and schedule. Leading the chart is **${top.event.title}** (${top.zones.length} zones, from ${formatPrice(top.minPrice)}).`
          : `Đây là bảng xếp hạng các đêm diễn nổi bật nhất hiện tại dựa trên mật độ giữ/mua ghế trực tiếp, quy mô khu vực và lịch diễn. Dẫn đầu là **${top.event.title}** (${top.zones.length} khu vực, từ ${formatPrice(top.minPrice)}).`,
      payload: { kind: 'trending', events: ranked },
      suggestions: isOrganizer
        ? lang === 'en'
          ? [`Stage graph for ${top.event.title.split(' ')[0]}`, 'Occupancy heatmap', 'Recommend events']
          : ['Biểu đồ sân khấu sự kiện top 1', 'Bản đồ nhiệt lấp đầy', 'Biểu đồ khung giá']
        : lang === 'en'
          ? ['Recommend by preference', 'Concerts under 1M VND', 'Brief all events']
          : ['Gợi ý theo sở thích', 'Concert dưới 1 triệu', 'Tóm tắt tất cả sự kiện']
    };
  }

  // 3. Specific event brief (takes priority over implicit genre aliases when user names an event without asking for recommendations)
  const matchedEvent = matchEventFromQuery(userInput, enriched, ctx.currentEventId);
  const asksRecommend = /(recommend|suggest|goi y|de xuat|phu hop|suit|preference|so thich|chon gi|di xem gi|tu van|tuong tu|similar|like )/.test(
    norm
  );
  const asksBrief = /(brief|tom tat|gioi thieu|thong tin|summary|overview|lich dien|tat ca|all event|danh sach|chi tiet|about|what event|co gi)/.test(
    norm
  );

  if (matchedEvent && !asksRecommend) {
    const standingCount = matchedEvent.zones.filter(z => z.kind === 'standing').length;
    const seatedCount = matchedEvent.zones.length - standingCount;
    return {
      sender: 'assistant',
      text:
        lang === 'en'
          ? `Here is the live brief for **${matchedEvent.event.title}** at ${matchedEvent.event.venue} (${matchedEvent.event.city}): ${matchedEvent.zones.length} zones (${seatedCount} seated, ${standingCount} standing), prices from **${formatPrice(matchedEvent.minPrice)}** to **${formatPrice(matchedEvent.maxPrice)}**, with **${matchedEvent.availableSeats}/${matchedEvent.totalSeats}** seats currently open.`
          : `Tóm tắt nhanh **${matchedEvent.event.title}** tại ${matchedEvent.event.venue} (${matchedEvent.event.city}): gồm **${matchedEvent.zones.length} khu vực** (${seatedCount} khu ngồi, ${standingCount} khu đứng), giá từ **${formatPrice(matchedEvent.minPrice)}** đến **${formatPrice(matchedEvent.maxPrice)}**, hiện còn **${matchedEvent.availableSeats}/${matchedEvent.totalSeats}** chỗ trống.`,
      payload: { kind: 'brief', events: [matchedEvent], focusSingle: true },
      suggestions: isOrganizer
        ? lang === 'en'
          ? ['Visualize this stage graph', 'Compare zone pricing', 'Trending events']
          : ['Vẽ sơ đồ sân khấu sự kiện này', 'Xem biểu đồ khung giá', 'Sự kiện đang hot']
        : lang === 'en'
          ? ['Trending events', 'Recommend similar shows', 'Brief all events']
          : ['Sự kiện đang hot', 'Gợi ý đêm diễn tương tự', 'Tóm tắt tất cả sự kiện']
    };
  }

  // 4. Preference-based recommendation intent
  const prefs = extractPreferences(userInput, enriched);
  const hasExplicitPrefs =
    Boolean(prefs.genre || prefs.city || prefs.seating || prefs.maxBudget !== undefined || prefs.minBudget !== undefined);

  if (asksRecommend && !hasExplicitPrefs) {
    return {
      sender: 'assistant',
      text:
        lang === 'en'
          ? 'Tell me what you enjoy — pick your preferred genre, city, budget, or seating style below (or type freely like *"K-pop in Hanoi under 1.5M"*), and I will match the best concerts for you.'
          : 'Hãy chọn gu nhạc, thành phố, ngân sách hoặc kiểu chỗ ngồi bạn thích bên dưới (hoặc nhắn trực tiếp ví dụ *"K-pop ở Hà Nội dưới 1.5 triệu"*), mình sẽ gợi ý đêm diễn hợp nhất cho bạn.',
      payload: { kind: 'preference_picker', initial: {}, genres, cities },
      suggestions:
        lang === 'en'
          ? ['K-pop in Hanoi', 'V-pop under 1M VND', 'Standing pit concerts']
          : ['K-pop ở Hà Nội', 'V-pop dưới 1 triệu', 'Concert có khu đứng']
    };
  }

  if (hasExplicitPrefs || asksRecommend) {
    return buildRecommendationReply(enriched, prefs, lang);
  }

  // 5. Full schedule brief
  if (asksBrief) {
    const minAll = Math.min(...enriched.map(e => e.minPrice));
    const maxAll = Math.max(...enriched.map(e => e.maxPrice));
    return {
      sender: 'assistant',
      text:
        lang === 'en'
          ? `There are **${enriched.length} concerts** live in the database across **${cities.join(', ')}** (${genres.join(', ')}), with tickets ranging from **${formatPrice(minAll)}** to **${formatPrice(maxAll)}**. Tap any show below for details or seats.`
          : `Hiện có **${enriched.length} đêm diễn** đang mở bán tại **${cities.join(', ')}** (thể loại ${genres.join(', ')}), giá vé từ **${formatPrice(minAll)}** đến **${formatPrice(maxAll)}**. Chọn một đêm diễn bên dưới để xem chi tiết hoặc đặt ghế.`,
      payload: { kind: 'brief', events: enriched, focusSingle: false },
      suggestions: isOrganizer
        ? lang === 'en'
          ? ['Visualize stage graph', 'Occupancy heatmap', 'Trending events']
          : ['Trực quan hoá sơ đồ sân khấu', 'Bản đồ nhiệt lấp đầy', 'Sự kiện đang hot']
        : lang === 'en'
          ? ['What are the trending events?', 'Recommend by my preferences', 'Concerts under 1M VND']
          : ['Sự kiện nào đang hot?', 'Gợi ý theo sở thích', 'Concert dưới 1 triệu']
    };
  }

  // 6. Helpful default response tailored to user's role
  if (isOrganizer) {
    const fallback: Omit<ChatMessage, 'id' | 'timestamp'> = {
      sender: 'assistant',
      text:
        lang === 'en'
          ? `I'm your Organizer & Event Assistant connected to the live database (**${enriched.length} events**). I can give you a **brief sales analysis**, visualize interactive **stage topology graphs**, **occupancy heatmaps**, and **floor–base–ceiling pricing charts**.`
          : `Mình là Trợ lý Ban Tổ Chức kết nối trực tiếp với cơ sở dữ liệu (**${enriched.length} sự kiện**). Mình có thể **phân tích doanh thu & hiệu suất bán vé**, vẽ **sơ đồ sân khấu tương tác**, **bản đồ nhiệt lấp đầy** và **biểu đồ khung giá**.`,
      suggestions:
        lang === 'en'
          ? ['Brief sales analysis', 'Visualize stage graph', 'Occupancy heatmap', 'Zone pricing chart']
          : ['Phân tích bán vé', 'Vẽ sơ đồ sân khấu', 'Bản đồ nhiệt lấp đầy', 'Biểu đồ khung giá']
    };
    return attachOptionalLlm(fallback, 'help');
  }

  const userFallback: Omit<ChatMessage, 'id' | 'timestamp'> = {
    sender: 'assistant',
    text:
      lang === 'en'
        ? `I'm your SortMyScene Event Assistant (**${enriched.length} live concerts**). Ask me for an **event brief**, **trending concerts**, or **personalized recommendations** by genre, city, budget, or seating style!`
        : `Chào bạn! Mình là Trợ lý Sự kiện SortMyScene (**${enriched.length} concert** đang mở bán). Bạn có thể hỏi mình **tóm tắt sự kiện**, **concert đang hot**, hoặc **gợi ý theo gu nhạc, thành phố và ngân sách**!`,
    suggestions:
      lang === 'en'
        ? ['Brief all events', 'What is trending?', 'Recommend by preference']
        : ['Tóm tắt lịch diễn', 'Sự kiện đang hot', 'Gợi ý theo sở thích']
  };
  return attachOptionalLlm(userFallback, 'help');
}

async function buildSalesAnalysisReply(
  target: EnrichedEvent,
  allEvents: EnrichedEvent[],
  lang: AssistantLang
): Promise<Omit<ChatMessage, 'id' | 'timestamp'>> {
  const serverSummary = await apiFetchEventSalesSummary(target.event.id);
  const soldCount = serverSummary?.soldCount ?? target.soldSeats;
  const heldCount = serverSummary?.heldCount ?? target.heldSeats;
  const totalCap = serverSummary?.totalCapacity ?? target.totalSeats;
  const fillPct = Math.round((serverSummary?.fillRate ?? target.occupancyRate) * 100);
  const realized = serverSummary?.realizedRevenue ?? 0;
  const potential = serverSummary?.potentialRevenue ?? target.potentialRevenue;

  const text =
    lang === 'en'
      ? `Brief sales analysis for **${target.event.title}**: **${soldCount} sold** + **${heldCount} held** out of ${totalCap} seats (**${fillPct}%** fill rate) · realized revenue **${formatPriceShort(realized)}** out of **${formatPriceShort(potential)}** potential.`
      : `Phân tích bán vé nhanh cho **${target.event.title}**: **${soldCount} đã bán** + **${heldCount} đang giữ** trên ${totalCap} chỗ (lấp đầy **${fillPct}%**) · thực thu **${formatPriceShort(realized)}** / kỳ vọng **${formatPriceShort(potential)}**.`;

  return {
    sender: 'assistant',
    text,
    payload: {
      kind: 'sales_analysis',
      eventId: target.event.id,
      events: allEvents,
      serverSummary
    },
    suggestions:
      lang === 'en'
        ? ['Visualize stage heatmap', 'Show pricing bounds graph', 'Trending events']
        : ['Xem bản đồ nhiệt sân khấu', 'Xem biểu đồ khung giá', 'Sự kiện đang hot']
  };
}

function buildRecommendationReply(
  enriched: EnrichedEvent[],
  prefs: UserPreferences,
  lang: AssistantLang
): Omit<ChatMessage, 'id' | 'timestamp'> {
  const items = recommendByPreferences(enriched, prefs, lang);
  const parts: string[] = [];
  if (prefs.genre) parts.push(prefs.genre);
  if (prefs.city) parts.push(prefs.city);
  if (prefs.maxBudget !== undefined) {
    parts.push(lang === 'en' ? `≤ ${formatPriceShort(prefs.maxBudget)}` : `≤ ${formatPriceShort(prefs.maxBudget)}`);
  }
  if (prefs.minBudget !== undefined) {
    parts.push(lang === 'en' ? `≥ ${formatPriceShort(prefs.minBudget)}` : `≥ ${formatPriceShort(prefs.minBudget)}`);
  }
  if (prefs.seating) {
    parts.push(
      prefs.seating === 'standing'
        ? lang === 'en'
          ? 'Standing'
          : 'Khu đứng'
        : lang === 'en'
          ? 'Seated'
          : 'Ghế ngồi'
    );
  }

  const filterSummary = parts.length > 0 ? ` (${parts.join(' · ')})` : '';
  return {
    sender: 'assistant',
    text:
      lang === 'en'
        ? `Based on your preferences${filterSummary}, here are the top **${items.length}** matches from our live schedule:`
        : `Dựa trên sở thích của bạn${filterSummary}, đây là **${items.length} đêm diễn** phù hợp nhất đang mở bán:`,
    payload: { kind: 'recommendations', items, preferences: prefs },
    suggestions:
      lang === 'en'
        ? ['Change preferences', 'Trending events', 'Brief all events']
        : ['Chọn lại sở thích', 'Sự kiện đang hot', 'Tóm tắt lịch diễn']
  };
}

function buildStageGraphReply(
  target: EnrichedEvent,
  allEvents: EnrichedEvent[],
  lang: AssistantLang,
  tab: StageGraphTab,
  overlay: StageMapOverlay
): Omit<ChatMessage, 'id' | 'timestamp'> {
  const standingZones = target.zones.filter(z => z.kind === 'standing').length;
  const seatedZones = target.zones.length - standingZones;
  const occPct = Math.round(target.occupancyRate * 100);

  const text =
    lang === 'en'
      ? `Interactive stage graph for **${target.event.title}** (${target.zones.length} zones: ${standingZones} standing pit, ${seatedZones} seated tiers · **${occPct}%** live occupancy · potential revenue **${formatPriceShort(target.potentialRevenue)}**). Click any zone to inspect capacity, holds, and pricing bounds.`
      : `Biểu đồ sân khấu trực tiếp cho **${target.event.title}** (${target.zones.length} khu vực: ${standingZones} khu đứng, ${seatedZones} khán đài ngồi · lấp đầy **${occPct}%** · doanh thu kỳ vọng **${formatPriceShort(target.potentialRevenue)}**). Nhấn vào từng khu trên sơ đồ để xem chi tiết ghế và khung giá.`;

  return {
    sender: 'assistant',
    text,
    payload: {
      kind: 'stage_graph',
      eventId: target.event.id,
      events: allEvents,
      initialTab: tab,
      initialOverlay: overlay
    },
    suggestions:
      lang === 'en'
        ? ['Show occupancy heatmap', 'Show pricing bounds graph', 'Show capacity & revenue chart', 'Trending events']
        : ['Xem bản đồ nhiệt lấp đầy', 'Xem biểu đồ khung giá', 'Biểu đồ sức chứa & doanh thu', 'Sự kiện đang hot']
  };
}
