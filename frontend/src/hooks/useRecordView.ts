import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { recordEventView } from '../services/recommendationService';

/** Tells the recommender that the signed-in user opened this event. */
export function useRecordView(eventId: string | undefined): void {
  const { isAuthenticated } = useAuth();
  const { isEnabled } = useFeatures();
  const on = isEnabled('recommendations');
  useEffect(() => {
    if (on && isAuthenticated && eventId) recordEventView(eventId);
  }, [on, isAuthenticated, eventId]);
}
