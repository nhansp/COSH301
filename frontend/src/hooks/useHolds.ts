import { useCallback, useEffect, useState } from 'react';
import { Hold } from '../types';
import { apiFetchHolds, apiReleaseSeat } from '../services/eventService';

/** Re-renders once a second so countdowns derived from `expiresAt` stay current. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** The signed-in user's active holds; the server is the only source of truth. */
export function useHolds(enabled: boolean) {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const now = useNow(holds.length > 0);

  const refresh = useCallback(async () => {
    setStatus('loading');
    const data = await apiFetchHolds();
    if (data) setHolds(data);
    setStatus(data ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  // A hold past its expiry is already freed by the server; stop listing it.
  const active = holds.filter(h => Date.parse(h.expiresAt) > now);

  // Local state changes only after the server confirms the release.
  const release = async (hold: Hold) => {
    setReleaseError(null);
    setReleasingId(hold.seatId);
    const ok = await apiReleaseSeat(hold.eventId, hold.seatId);
    setReleasingId(null);
    if (ok) setHolds(prev => prev.filter(h => h.seatId !== hold.seatId));
    else setReleaseError(`Chưa trả được ghế ${hold.seatLabel}. Thử lại sau giây lát.`);
  };

  return { holds: active, now, status, refresh, release, releasingId, releaseError };
}
