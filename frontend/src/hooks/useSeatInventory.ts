import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SeatItem } from '../types';
import { apiFetchHolds, apiFetchSeats, apiHoldSeat, apiReleaseSeat, formatPrice } from '../services/eventService';
import { loadOrganizerTestCart } from '../services/organizerTestCart';

export type InventoryNotice = { id: number; text: string; tone: 'error' | 'info' | 'success' };

export interface HoldOutcome {
  ok: boolean;
  /** Set when the user must sign in before holding. */
  needsLogin?: boolean;
}

interface Options {
  eventId: string | undefined;
  /** Most seats the user may hold at once; `Infinity` while the server enforces no ticket limit. */
  maxSeats: number;
  holdEnabled: boolean;
  /** Organizer preview mode: simulates seat selection locally with zero database writes. */
  testMode?: boolean;
}

const HOLD_ERRORS: Record<string, (seat: SeatItem) => string> = {
  seat_not_available: seat => `Ghế ${seat.label} vừa có người giữ. Chọn ghế khác trong khu ${seat.zoneName}.`,
  ticket_limit_reached: () => 'Đã đạt giới hạn số vé cho sự kiện này.',
  event_not_on_sale: () => 'Sự kiện hiện không mở bán.',
  organizer_test_only: () => 'Tài khoản Ban Tổ Chức chỉ dùng chế độ kiểm thử cục bộ.'
};

/**
 * Seat state for one event: initial load, live SSE updates, holds and their
 * expiry. The 3D venue, the 2D grid and the side panels all read from here.
 */
export function useSeatInventory({ eventId, maxSeats, holdEnabled, testMode = false }: Options) {
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

  /** `silent` keeps the current map on screen if the reload fails (used after a reconnect). */
  const load = useCallback(
    async (silent = false) => {
      if (!eventId) return;
      const result = await apiFetchSeats(eventId);
      if (!result || result.length === 0) {
        if (!silent) setLoadState('error');
        return;
      }
      if (testMode) {
        const saved = loadOrganizerTestCart(eventId);
        const savedIds = new Set(saved?.seats.map(s => s.id) ?? []);
        const savedExp = saved ? Date.parse(saved.expiresAt) : NaN;
        const merged = result.map(s =>
          savedIds.has(s.id) && s.status === 'available' ? { ...s, status: 'selected' as const } : s
        );
        setSeats(merged);
        setLoadState('ready');
        if (!Number.isNaN(savedExp) && merged.some(s => s.status === 'selected')) {
          setExpiries(Object.fromEntries(merged.filter(s => s.status === 'selected').map(s => [s.id, savedExp])));
        } else {
          setExpiries({});
        }
        return;
      }

      setSeats(result);
      setLoadState('ready');
      // Hold expiries come from the server, so the countdown also survives a reload or another tab.
      if (result.some(s => s.status === 'selected')) {
        const holds = await apiFetchHolds();
        if (holds) {
          setExpiries(Object.fromEntries(holds.filter(h => h.eventId === eventId).map(h => [h.seatId, Date.parse(h.expiresAt)])));
        }
      } else {
        setExpiries({});
      }
    },
    [eventId, testMode]
  );
  const loadRef = useRef(load);
  loadRef.current = load;
  // Set when the stream drops, so the next successful open reloads what was missed.
  const needsResync = useRef(false);
  const updateExpiries = setExpiries;

  useEffect(() => {
    setLoadState('loading');
    load();
  }, [load]);

  useEffect(() => {
    if (!eventId) return;
    const sse = new EventSource(`/api/events/${eventId}/stream`);
    const markConnected = () => {
      setLiveState('connected');
      if (needsResync.current) {
        needsResync.current = false;
        loadRef.current(true);
      }
    };
    sse.addEventListener('connected', markConnected);
    sse.onopen = markConnected;
    sse.onerror = () => {
      needsResync.current = true;
      setLiveState('disconnected');
    };
    sse.addEventListener('update', (e: MessageEvent) => {
      try {
        const { type, seatId, status } = JSON.parse(e.data);
        if (!seatId || !status) return;
        const next: SeatItem['status'] = status === 'AVAILABLE' ? 'available' : status === 'SOLD' ? 'sold' : 'held';
        const wasMine = mineRef.current.some(s => s.id === seatId);
        // The stream does not say who holds a seat, so our own holds stay "selected" (except in testMode,
        // where local test selections always yield to real customer holds/sales).
        setSeats(prev =>
          prev.map(s =>
            s.id !== seatId ? s : !testMode && next === 'held' && s.status === 'selected' ? s : { ...s, status: next }
          )
        );
        if (testMode && wasMine && (next === 'held' || next === 'sold')) {
          updateExpiries(prev => {
            const { [seatId]: _dropped, ...rest } = prev;
            return rest;
          });
        }
        if (!testMode && wasMine && (type === 'seat_released' || type === 'seat_expired')) {
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
  }, [eventId, testMode, notify, updateExpiries]);

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
      if (testMode) {
        const at = Date.now() + 5 * 60 * 1000;
        updateExpiries(prev => ({ ...prev, [seat.id]: at }));
        setStatus(seat.id, 'selected');
        mineRef.current = [...mineRef.current, { ...seat, status: 'selected' }];
        if (!quiet) notify(`Đã chọn thử ghế ${seat.label} · ${formatPrice(seat.price)} (Chế độ BTC — không khóa ghế thật)`, 'info');
        return { ok: true };
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
      if (!quiet) notify(`Đã giữ ghế ${seat.label} · ${formatPrice(seat.price)}`, 'success');
      return { ok: true };
    },
    [eventId, holdEnabled, maxSeats, testMode, notify, updateExpiries]
  );

  /** Frees a seat locally only once the server confirms it; resolves to whether it did. */
  const release = useCallback(
    async (seat: SeatItem, { quiet = false } = {}): Promise<boolean> => {
      if (!eventId) return false;
      if (testMode) {
        setStatus(seat.id, 'available');
        mineRef.current = mineRef.current.filter(s => s.id !== seat.id);
        updateExpiries(prev => {
          const { [seat.id]: _dropped, ...rest } = prev;
          return rest;
        });
        if (!quiet) notify(`Đã bỏ chọn thử ghế ${seat.label}.`, 'info');
        return true;
      }
      markPending(seat.id, true);
      const released = await apiReleaseSeat(eventId, seat.id);
      markPending(seat.id, false);
      if (!released) {
        notify(`Chưa trả được ghế ${seat.label}. Thử lại sau giây lát.`, 'error');
        return false;
      }
      setStatus(seat.id, 'available');
      mineRef.current = mineRef.current.filter(s => s.id !== seat.id);
      updateExpiries(prev => {
        const { [seat.id]: _dropped, ...rest } = prev;
        return rest;
      });
      if (!quiet) notify(`Đã trả ghế ${seat.label}.`, 'info');
      return true;
    },
    [eventId, testMode, notify, updateExpiries]
  );

  /**
   * Standing zones are sold as interchangeable places, so the user picks a
   * count and we hold that many free slots, skipping ones taken meanwhile.
   */
  const setZoneCount = useCallback(
    async (zoneId: string, zoneName: string, count: number): Promise<HoldOutcome> => {
      const held = mineRef.current.filter(s => s.zoneId === zoneId);
      if (count < held.length) {
        for (const seat of held.slice(count)) {
          if (!(await release(seat, { quiet: true }))) return { ok: false };
        }
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
