import http from 'k6/http';
import exec from 'k6/execution';
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';

// 100 accounts try to hold the same seat at the same moment; exactly one may win.
const BASE = __ENV.BASE || 'https://cosh301.nhansp.id.vn';
const EVENT_SLUG = __ENV.EVENT || 'anh-trai-say-hi-ha-noi-2024';
const ZONE = __ENV.ZONE || 'VieVIP (ngồi)';
const SEAT = __ENV.SEAT || 'A1';
const TOKENS = JSON.parse(open(__ENV.TOKENS || './tokens.json'));

const winners = new Counter('race_winners');
const losers = new Counter('race_losers');

export const options = {
  scenarios: { race: { executor: 'shared-iterations', vus: 100, iterations: 100, maxDuration: '1m' } },
  thresholds: { race_winners: ['count==1'] },
};

export function setup() {
  const event = http.get(`${BASE}/api/events`).json().find(e => e.slug === EVENT_SLUG);
  const seat = http.get(`${BASE}/api/events/${event.id}/seats`).json()
    .find(s => s.zoneName === ZONE && s.label === SEAT && s.status === 'available');
  if (!seat) throw new Error(`seat ${SEAT} in ${ZONE} is not available`);
  return { eventId: event.id, seatId: seat.seatId };
}

export default function (d) {
  const token = TOKENS[exec.scenario.iterationInTest % TOKENS.length];
  const auth = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  const r = http.post(`${BASE}/api/holds`, JSON.stringify(d), auth);
  if (r.status === 200 || r.status === 201) {
    winners.add(1);
    // Keep the seat until every other request has been answered; releasing at once
    // would let a slower request win it fairly a moment later.
    sleep(Number(__ENV.HOLD_SECONDS || 10));
    http.del(`${BASE}/api/holds/${d.seatId}?eventId=${d.eventId}`, null, auth);
  } else {
    losers.add(1);
  }
}
