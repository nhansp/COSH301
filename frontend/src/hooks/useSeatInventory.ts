import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SeatItem } from '../types';
import { apiFetchSeats, apiHoldSeat, apiReleaseSeat, formatPrice } from '../services/eventService';

export type InventoryNotice = { id: number; text: string; tone: 'error' | 'info' | 'success' };

export interface HoldOutcome {
  ok: boolean;
  /** Set when the user must sign in before holding. */
  needsLogin?: boolean;
}

interface Options {
  eventId: string | undefined;
  /** Tickets the user may still take for this event, holds included. */
  maxSeats: number;
  holdEnabled: boolean;
}

const EXPIRY_KEY = (eventId: string) => `sms_hold_expiry:${eventId}`;

/** Server-issued hold expiries (epoch ms) by seat, kept for the checkout page. */
export function readHoldExpiries(eventId: string): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(EXPIRY_KEY(eventId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeHoldExpiries(eventId: string, expiries: Record<string, number>) {
  try {
    sessionStorage.setItem(EXPIRY_KEY(eventId), JSON.stringify(expiries));
  } catch {
    // Storage can be unavailable (private mode); the countdown just falls back to the default.
  }
}

const HOLD_ERRORS: Record<string, (seat: SeatItem) => string> = {
  seat_not_available: seat => `Ghế ${seat.label} vừa có người giữ. Chọn ghế khác trong khu ${seat.zoneName}.`,
  ticket_limit_reached: () => 'Đã đạt giới hạn số vé cho sự kiện này.',
  event_not_on_sale: () => 'Sự kiện hiện không mở bán.'
};

/**
 * Seat state for one event: initial load, live SSE updates, holds and their
 * expiry. The 3D venue, the 2D grid and the side panels all read from here.
 */
export function useSeatInventory({ eventId, maxSeats, holdEnabled }: Options) {
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [liveState, setLiveState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [expiries, setExpiries] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<InventoryNotice | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const noticeId = useRef(0);

  const notify = useCallback((text: string, tone: InventoryNotice['tone'] = 'info') => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, text, tone });
  }, []);

  const mine = useMemo(() => seats.filter(s => s.status === 'selected'), [seats]);
  const mineRef = useRef(mine);
  mineRef.current = mine;

  const updateExpiries = useCallback(
    (update: (prev: Record<string, number>) => Record<string, number>) => {
      setExpiries(prev => {
        const next = update(prev);
        if (eventId) writeHoldExpiries(eventId, next);
        return next;
      });
    },
    [eventId]
  );

  const load = useCallback(async () => {
    if (!eventId) return;
    const result = await apiFetchSeats(eventId);
    if (!result || result.length === 0) {
      setLoadState('error');
      return;
    }
    setSeats(result);
    setLoadState('ready');
    // Keep only expiries for holds the server still reports as ours and that have not passed:
    // if the server lags behind our clock, the hold stays shown but the countdown goes away.
    const held = new Set(result.filter(s => s.status === 'selected').map(s => s.id));
    const stored = readHoldExpiries(eventId);
    const now = Date.now();
    updateExpiries(() => Object.fromEntries(Object.entries(stored).filter(([id, at]) => held.has(id) && at > now)));
  }, [eventId, updateExpiries]);

  useEffect(() => {
    setLoadState('loading');
    load();
  }, [load]);

  useEffect(() => {
    if (!eventId) return;
    const sse = new EventSource(`/api/events/${eventId}/stream`);
    sse.addEventListener('connected', () => setLiveState('connected'));
    sse.onopen = () => setLiveState('connected');
    sse.onerror = () => setLiveState('disconnected');
    sse.addEventListener('update', (e: MessageEvent) => {
      try {
        const { type, seatId, status } = JSON.parse(e.data);
        if (!seatId || !status) return;
        const next: SeatItem['status'] = status === 'AVAILABLE' ? 'available' : status === 'SOLD' ? 'sold' : 'held';
        const wasMine = mineRef.current.some(s => s.id === seatId);
        // The stream does not say who holds a seat, so our own holds stay "selected".
        setSeats(prev =>
          prev.map(s => (s.id !== seatId ? s : next === 'held' && s.status === 'selected' ? s : { ...s, status: next }))
        );
        if (wasMine && (type === 'seat_released' || type === 'seat_expired')) {
          updateExpiries(prev => {
            const { [seatId]: _dropped, ...rest } = prev;
            return rest;
          });
          if (type === 'seat_expired') {
            const label = seatsRef.current.find(s => s.id === seatId)?.label ?? '';
            notify(`Hết 5 phút giữ chỗ, ghế ${label} đã được trả lại.`, 'error');
          }
        }
      } catch {
        // Ignore malformed frames; the next full load resyncs.
      }
    });
    return () => sse.close();
  }, [eventId, notify, updateExpiries]);

  // Countdown to the earliest expiry among the user's holds.
  const knownExpiries = mine.map(s => expiries[s.id]).filter((at): at is number => at !== undefined);
  const expiresAt = knownExpiries.length > 0 ? Math.min(...knownExpiries) : null;
  const secondsLeft = expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / 1000));

  useEffect(() => {
    if (expiresAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    notify('Hết 5 phút giữ chỗ. Các ghế đã được trả lại, bạn có thể chọn lại.', 'error');
    load();
  }, [secondsLeft, load, notify]);

  const setStatus = (seatId: string, status: SeatItem['status']) =>
    setSeats(prev => prev.map(s => (s.id === seatId ? { ...s, status } : s)));

  const markPending = (seatId: string, on: boolean) =>
    setPending(prev => {
      const next = new Set(prev);
      if (on) next.add(seatId);
      else next.delete(seatId);
      return next;
    });

  /** Holds one seat. Messages for every failure are raised through `notice`. */
  const hold = useCallback(
    async (seat: SeatItem, { quiet = false } = {}): Promise<HoldOutcome & { error?: string }> => {
      if (!eventId) return { ok: false };
      if (!holdEnabled) {
        notify('Tính năng giữ chỗ đang tạm tắt, hiện chưa chọn được ghế.', 'info');
        return { ok: false };
      }
      if (mineRef.current.length >= maxSeats) {
        notify('Đã đạt giới hạn số vé cho sự kiện này.', 'error');
        return { ok: false, error: 'ticket_limit_reached' };
      }
      markPending(seat.id, true);
      const res = await apiHoldSeat(eventId, seat.id);
      markPending(seat.id, false);
      if (!res.success) {
        if (res.error === 'unauthorized') return { ok: false, needsLogin: true };
        if (res.error === 'seat_not_available') setStatus(seat.id, 'held');
        if (!quiet || res.error !== 'seat_not_available') {
          notify((HOLD_ERRORS[res.error ?? ''] ?? (() => `Chưa giữ được ghế ${seat.label}. Thử lại sau giây lát.`))(seat), 'error');
        }
        return { ok: false, error: res.error };
      }
      const at = res.expiresAt ? Date.parse(res.expiresAt) : NaN;
      if (!Number.isNaN(at)) updateExpiries(prev => ({ ...prev, [seat.id]: at }));
      setStatus(seat.id, 'selected');
      // Keep the ref current for loops that hold several seats in one go.
      mineRef.current = [...mineRef.current, { ...seat, status: 'selected' }];
      if (!quiet) notify(`Đã giữ ghế ${seat.label} · ${formatPrice(seat.price, '₫')}`, 'success');
      return { ok: true };
    },
    [eventId, holdEnabled, maxSeats, notify, updateExpiries]
  );

  const release = useCallback(
    async (seat: SeatItem, { quiet = false } = {}) => {
      if (!eventId) return;
      markPending(seat.id, true);
      await apiReleaseSeat(eventId, seat.id).catch(() => false);
      markPending(seat.id, false);
      setStatus(seat.id, 'available');
      mineRef.current = mineRef.current.filter(s => s.id !== seat.id);
      updateExpiries(prev => {
        const { [seat.id]: _dropped, ...rest } = prev;
        return rest;
      });
      if (!quiet) notify(`Đã trả ghế ${seat.label}.`, 'info');
    },
    [eventId, notify, updateExpiries]
  );

  /**
   * Standing zones are sold as interchangeable places, so the user picks a
   * count and we hold that many free slots, skipping ones taken meanwhile.
   */
  const setZoneCount = useCallback(
    async (zoneId: string, zoneName: string, count: number): Promise<HoldOutcome> => {
      const held = mineRef.current.filter(s => s.zoneId === zoneId);
      if (count < held.length) {
        for (const seat of held.slice(count)) await release(seat, { quiet: true });
        notify(`Còn giữ ${count} vé đứng ở ${zoneName}.`, 'info');
        return { ok: true };
      }
      let got = held.length;
      const free = seatsRef.current.filter(s => s.zoneId === zoneId && s.status === 'available');
      for (const seat of free) {
        if (got >= count) break;
        const res = await hold(seat, { quiet: true });
        if (res.needsLogin) return { ok: false, needsLogin: true };
        if (res.ok) got += 1;
        else if (res.error !== 'seat_not_available') break;
      }
      if (got < count) {
        notify(`Chỉ giữ được ${got} trên ${count} vé. ${zoneName} vừa hết chỗ.`, 'error');
        return { ok: got > held.length };
      }
      notify(`Đã giữ ${got} vé đứng ở ${zoneName}.`, 'success');
      return { ok: true };
    },
    [hold, release, notify]
  );

  return {
    seats,
    mine,
    loadState,
    liveState,
    pending,
    expiresAt,
    secondsLeft,
    notice,
    dismissNotice: () => setNotice(null),
    notify,
    reload: load,
    hold,
    release,
    setZoneCount
  };
}

export type SeatInventory = ReturnType<typeof useSeatInventory>;
