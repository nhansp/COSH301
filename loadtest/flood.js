import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Browsing load plus many customers fighting over one zone. Each successful hold is
// released after a few seconds, so the seat map keeps changing while the test runs.
const BASE = __ENV.BASE || 'https://cosh301.nhansp.id.vn';
const EVENT_SLUG = __ENV.EVENT || 'anh-trai-say-hi-ha-noi-2024';
const ZONE = __ENV.ZONE || 'VieVIP (ngồi)';
const DURATION = __ENV.DURATION || '60s';
const VIEWERS = Number(__ENV.VIEWERS || 200);
const HOLDERS = Number(__ENV.HOLDERS || 60);
const TOKENS = JSON.parse(open(__ENV.TOKENS || './tokens.json'));

const holdOk = new Counter('giu_ghe_thanh_cong');
const holdConflict = new Counter('giu_ghe_bi_tu_choi');
const holdLatency = new Trend('thoi_gian_giu_ghe', true);

export const options = {
  scenarios: {
    xem: { executor: 'ramping-vus', exec: 'browse', startVUs: 0, stages: [{ duration: '15s', target: VIEWERS }, { duration: DURATION, target: VIEWERS }] },
    giu_ghe: { executor: 'constant-vus', exec: 'holds', vus: HOLDERS, duration: DURATION, startTime: '5s' },
  },
  summaryTrendStats: ['avg', 'p(95)', 'max'],
};

export function setup() {
  const event = http.get(`${BASE}/api/events`).json().find(e => e.slug === EVENT_SLUG);
  if (!event) throw new Error(`event ${EVENT_SLUG} not found`);
  const seats = http.get(`${BASE}/api/events/${event.id}/seats`).json()
    .filter(s => s.status === 'available' && s.zoneName === ZONE)
    .map(s => ({ eventId: event.id, seatId: s.seatId }));
  if (!seats.length) throw new Error(`no available seats in ${ZONE}`);
  return { eventId: event.id, seats };
}

const auth = t => ({ headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } });

export function browse(d) {
  check(http.get(`${BASE}/api/events`), { 'xem sự kiện 200': r => r.status === 200 });
  sleep(Math.random() + 0.5);
  check(http.get(`${BASE}/api/events/${d.eventId}/seats`), { 'xem sơ đồ ghế 200': r => r.status === 200 });
  sleep(Math.random() + 0.5);
}

export function holds(d) {
  const token = TOKENS[exec.vu.idInTest % TOKENS.length];
  const s = d.seats[Math.floor(Math.random() * d.seats.length)];
  const r = http.post(`${BASE}/api/holds`, JSON.stringify(s), auth(token));
  holdLatency.add(r.timings.duration);
  if (r.status === 200 || r.status === 201) {
    holdOk.add(1);
    sleep(3);
    http.del(`${BASE}/api/holds/${s.seatId}?eventId=${s.eventId}`, null, auth(token));
  } else if (r.status === 409) {
    holdConflict.add(1);
  }
  sleep(Math.random() * 0.5);
}
