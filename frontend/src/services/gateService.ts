/** The code a ticket shows right now; the server signs it and rotates it every period. */
export interface TicketQR {
  payload: string;
  expiresAt: string;
  periodSec: number;
}

export type TicketQRResult = { kind: 'ok'; qr: TicketQR } | { kind: 'used' } | { kind: 'error' };

export async function apiFetchTicketQR(ticketId: string): Promise<TicketQRResult> {
  try {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/qr`, { credentials: 'include', cache: 'no-store' });
    if (res.status === 409) return { kind: 'used' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'ok', qr: await res.json() };
  } catch {
    return { kind: 'error' };
  }
}

export type CheckinResult = 'VALID' | 'ALREADY_USED' | 'INVALID' | 'VOID';

export interface CheckinOutcome {
  result: CheckinResult;
  eventId?: string;
  eventName?: string;
  seatLabel?: string;
  zoneName?: string;
  ticketCode?: string;
  holder?: string;
  scannedAt?: string;
  firstUsedAt?: string;
  wrongEvent?: boolean;
  eventCheckins?: number;
}

/** Sends a scanned code to the server; null means the request itself failed. */
export async function apiCheckin(payload: string, eventId: string): Promise<CheckinOutcome | null> {
  try {
    const res = await fetch('/api/gate/checkin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, eventId: eventId || undefined }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
