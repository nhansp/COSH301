export type RecommendationTier = 'TOP_PICK' | 'TRENDING' | 'DISCOVERY' | 'MORE' | 'POPULAR';

export interface RecommendedEvent {
  id: string;
  slug: string;
  name: string;
  score: number;
  tier: RecommendationTier;
  personalized: boolean;
  reasons: string[] | null;
  bestZone?: { zoneId: string; zoneCode: string; zoneName: string; price: number; available: number };
}

export const TIER_LABEL: Record<RecommendationTier, string> = {
  TOP_PICK: 'Hợp nhất với bạn',
  TRENDING: 'Xu hướng hợp gu',
  DISCOVERY: 'Khám phá thêm',
  MORE: 'Có thể bạn thích',
  POPULAR: 'Đang được quan tâm'
};

/** Personal picks when signed in, popular events otherwise; null when unavailable. */
export async function fetchRecommendations(limit = 6): Promise<RecommendedEvent[] | null> {
  try {
    const res = await fetch(`/api/recommendations/events?limit=${limit}`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Tells the recommender the signed-in user opened an event. Failures are ignored. */
export function recordEventView(eventId: string): void {
  fetch(`/api/events/${encodeURIComponent(eventId)}/views`, { method: 'POST', credentials: 'include' }).catch(() => {});
}
