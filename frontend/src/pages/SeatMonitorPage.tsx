import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { useEvents } from '../context/EventContext';
import { apiFetchSeats, formatPrice } from '../services/eventService';
import { SeatItem } from '../types';

type SeatState = 'available' | 'held' | 'sold';
interface FeedItem {
  id: number;
  at: Date;
  text: string;
  tone: SeatState | 'price';
}

const ACTION: Record<string, [string, SeatState]> = {
  seat_held: ['được giữ', 'held'],
  seat_released: ['được trả lại', 'available'],
  seat_expired: ['hết hạn giữ', 'available'],
  seat_sold: ['đã bán', 'sold'],
};
const CELL: Record<SeatState, string> = {
  available: 'bg-[#1f8a5b] text-white',
  held: 'bg-[#f2b45a] text-[#11121a]',
  sold: 'bg-[#4a4d5e] text-white/70',
};
const WINDOW = 60;

/** A live, read-only view of every seat of one event, for the organizer's big screen. */
export const SeatMonitorPage: React.FC = () => {
  const { events } = useEvents();
  const [eventId, setEventId] = useState('');
  const [zoneId, setZoneId] = useState('all');
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [live, setLive] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<number[]>(() => Array(WINDOW).fill(0));
  const holdTimes = useRef<number[]>([]);
  const seatsRef = useRef<SeatItem[]>([]);
  const counter = useRef(0);
  seatsRef.current = seats;

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);

  const load = useCallback(async (id: string) => {
    const data = await apiFetchSeats(id);
    if (!data) return;
    setSeats(data.map(s => ({ ...s, status: s.status === 'selected' ? 'held' : s.status })));
    const p: Record<string, number> = {};
    data.forEach(s => {
      if (p[s.zoneId] === undefined) p[s.zoneId] = s.price;
    });
    setPrices(p);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setSeats([]);
    setFeed([]);
    setZoneId('all');
    holdTimes.current = [];
    load(eventId);
    const sse = new EventSource(`/api/events/${eventId}/stream`);
    let resync = false;
    const connected = () => {
      setLive('connected');
      if (resync) {
        resync = false;
        load(eventId);
      }
    };
    sse.addEventListener('connected', connected);
    sse.onopen = connected;
    sse.onerror = () => {
      resync = true;
      setLive('disconnected');
    };
    sse.addEventListener('update', (e: MessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      const at = new Date();
      if (msg.type === 'price_changed') {
        setPrices(prev => ({ ...prev, [msg.zoneId]: msg.newPrice }));
        const zone = seatsRef.current.find(s => s.zoneId === msg.zoneId)?.zoneName ?? '';
        setFeed(prev => [{ id: ++counter.current, at, tone: 'price' as const, text: `Giá ${zone}: ${formatPrice(msg.oldPrice)} → ${formatPrice(msg.newPrice)}` }, ...prev].slice(0, 12));
        return;
      }
      const action = ACTION[msg.type];
      if (!action || !msg.seatId) return;
      const [verb, state] = action;
      if (msg.type === 'seat_held') holdTimes.current.push(at.getTime());
      setSeats(prev => prev.map(s => (s.id === msg.seatId ? { ...s, status: state } : s)));
      setFlash(prev => ({ ...prev, [msg.seatId]: at.getTime() }));
      const seat = seatsRef.current.find(s => s.id === msg.seatId);
      if (seat) {
        setFeed(prev => [{ id: ++counter.current, at, tone: state, text: `Ghế ${seat.label} · ${seat.zoneName} ${verb}` }, ...prev].slice(0, 12));
      }
    });
    return () => sse.close();
  }, [eventId, load]);

  const zones = useMemo(() => {
    const m = new Map<string, { id: string; name: string; seats: SeatItem[] }>();
    seats.forEach(s => {
      if (!m.has(s.zoneId)) m.set(s.zoneId, { id: s.zoneId, name: s.zoneName, seats: [] });
      m.get(s.zoneId)!.seats.push(s);
    });
    return [...m.values()];
  }, [seats]);
  const shown = zoneId === 'all' ? zones : zones.filter(z => z.id === zoneId);
  const shownSeats = shown.flatMap(z => z.seats);
  const count = (st: SeatState) => shownSeats.filter(s => s.status === st).length;

  // Once a second: held seats for the chart, holds in the last minute, fading flashes.
  const [holdsPerMinute, setHoldsPerMinute] = useState(0);
  const heldNow = count('held');
  const heldRef = useRef(heldNow);
  heldRef.current = heldNow;
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      holdTimes.current = holdTimes.current.filter(t => now - t < 60_000);
      setHoldsPerMinute(holdTimes.current.length);
      setHistory(prev => [...prev.slice(1), heldRef.current]);
      setFlash(prev => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, t]) => now - t < 900));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const peak = Math.max(1, ...history);
  const path = history.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (WINDOW - 1)) * 600},${60 - (v / peak) * 56}`).join(' ');

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />
      <main className="page-enter mx-auto w-full max-w-page flex-1 px-4 pt-8 pb-16 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="type-display text-display-md">Giám sát ghế</h1>
            <p className="mt-1 flex items-center gap-2 text-kumo-subtle">
              <span
                aria-hidden="true"
                className={`inline-block size-2.5 rounded-full ${live === 'connected' ? 'animate-pulse bg-[#4fd39a]' : 'bg-[#f2b45a]'}`}
              />
              {live === 'connected' ? 'Đang cập nhật trực tiếp' : 'Đang kết nối lại…'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm text-kumo-subtle">
              Sự kiện
              <select value={eventId} onChange={e => setEventId(e.target.value)}
                className="mt-1 block min-h-11 rounded-lg bg-kumo-base px-3 text-kumo-strong ring ring-kumo-line">
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </label>
            <label className="text-sm text-kumo-subtle">
              Khu
              <select value={zoneId} onChange={e => setZoneId(e.target.value)}
                className="mt-1 block min-h-11 rounded-lg bg-kumo-base px-3 text-kumo-strong ring ring-kumo-line">
                <option value="all">Tất cả khu</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ['Còn trống', count('available'), 'text-[#4fd39a]'],
            ['Đang giữ', heldNow, 'text-[#f2b45a]'],
            ['Đã bán', count('sold'), 'text-kumo-strong'],
            ['Lượt giữ trong 1 phút', holdsPerMinute, 'text-kumo-strong'],
          ] as const).map(([label, value, color]) => (
            <div key={label} className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
              <dt className="text-sm text-kumo-subtle">{label}</dt>
              <dd className={`type-figure mt-1 text-4xl tabular-nums ${color}`}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {shown.map(z => {
              const rows = new Map<string, SeatItem[]>();
              z.seats.forEach(s => rows.set(s.row, [...(rows.get(s.row) ?? []), s]));
              return (
                <section key={z.id} className="rounded-card bg-kumo-base p-4 ring ring-kumo-line sm:p-5">
                  <h2 className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold text-kumo-strong">{z.name}</span>
                    <span className="text-kumo-subtle tabular-nums">{formatPrice(prices[z.id] ?? 0)}</span>
                  </h2>
                  <div className="mt-3 space-y-1.5 overflow-x-auto">
                    {[...rows.entries()].map(([row, list]) => (
                      <div key={row} className="flex items-center gap-1.5">
                        <span className="w-6 shrink-0 text-sm text-kumo-subtle">{row}</span>
                        {list.map(s => (
                          <span
                            key={s.id}
                            title={`${s.label}: ${s.status}`}
                            className={`grid h-8 min-w-8 place-items-center rounded-md text-xs font-semibold tabular-nums transition-[background-color,transform] duration-300 ${CELL[s.status as SeatState] ?? CELL.available} ${flash[s.id] ? 'scale-125 ring-2 ring-white' : ''}`}
                          >
                            {s.number}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
            {!seats.length && <p className="text-kumo-subtle">Đang tải sơ đồ ghế…</p>}
          </div>

          <aside className="space-y-5">
            <div className="rounded-card bg-kumo-base p-4 ring ring-kumo-line">
              <h2 className="text-sm text-kumo-subtle">Ghế đang giữ, 60 giây qua</h2>
              <svg viewBox="0 0 600 60" className="mt-2 h-20 w-full" preserveAspectRatio="none" aria-label="Biểu đồ số ghế đang giữ">
                <path d={path} fill="none" stroke="#f2b45a" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="rounded-card bg-kumo-base p-4 ring ring-kumo-line">
              <h2 className="text-sm text-kumo-subtle">Diễn biến</h2>
              <ul aria-live="polite" className="mt-2 space-y-1.5 text-sm">
                {feed.length === 0 && <li className="text-kumo-subtle">Chưa có thay đổi.</li>}
                {feed.map(f => (
                  <li key={f.id} className="flex gap-2">
                    <span className="shrink-0 tabular-nums text-kumo-subtle">{f.at.toLocaleTimeString('vi-VN')}</span>
                    <span className={f.tone === 'held' ? 'text-[#f2b45a]' : f.tone === 'available' ? 'text-[#4fd39a]' : 'text-kumo-strong'}>{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </PageShell>
  );
};
