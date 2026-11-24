import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { EventTile } from './EventCard';
import { Reveal } from '../ui/Reveal';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventContext';
import { useFeatures } from '../../context/FeatureContext';
import { RecommendedEvent, TIER_LABEL, fetchRecommendations } from '../../services/recommendationService';
import { formatPriceShort } from '../../services/eventService';

/** Personal picks from the recommender; popular shows for visitors without history. */
export const RecommendedSection: React.FC = () => {
  const { isEnabled } = useFeatures();
  const { user } = useAuth();
  const { getEventById } = useEvents();
  const [recs, setRecs] = useState<RecommendedEvent[] | null>(null);
  const on = isEnabled('recommendations');

  useEffect(() => {
    if (!on) return;
    let live = true;
    fetchRecommendations(4).then(r => live && setRecs(r));
    return () => {
      live = false;
    };
  }, [on, user?.id]);

  const items = (recs ?? []).map(r => ({ r, event: getEventById(r.id) })).filter(x => x.event);
  if (!on || items.length === 0) return null;
  const personal = items.some(x => x.r.personalized);

  return (
    <section aria-labelledby="for-you-title" className="mx-auto max-w-page px-4 pb-16 sm:px-6 lg:px-10">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h2 id="for-you-title" className="type-display flex items-center gap-2 text-2xl sm:text-3xl">
            <Sparkles className="size-6 text-violet-ink" aria-hidden="true" />
            {personal ? 'Dành cho bạn' : 'Đang được quan tâm'}
          </h2>
          <p className="mt-1.5 text-kumo-subtle">
            {personal
              ? 'Gợi ý theo thể loại, thành phố và mức giá bạn hay chọn.'
              : 'Đêm diễn được xem và giữ ghế nhiều nhất tuần này. Đăng nhập để nhận gợi ý riêng.'}
          </p>
        </div>
      </div>
      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ r, event }, i) => (
          <Reveal as="li" key={r.id} delay={i * 70}>
            <EventTile event={event!} compact />
            <p className="mt-2 text-xs font-semibold text-violet-ink">{TIER_LABEL[r.tier]}</p>
            {(r.reasons ?? []).length > 0 && <p className="mt-0.5 text-sm text-kumo-subtle">{r.reasons!.join(' · ')}</p>}
            {r.personalized && r.bestZone && (
              <p className="mt-0.5 text-sm text-kumo-default">
                Gợi ý khu {r.bestZone.zoneName} · {formatPriceShort(r.bestZone.price)}
              </p>
            )}
          </Reveal>
        ))}
      </ul>
    </section>
  );
};
