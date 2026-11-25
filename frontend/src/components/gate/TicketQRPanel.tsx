import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { apiFetchTicketQR, TicketQR } from '../../services/gateService';

interface Props {
  ticketId: string;
  seatLabel: string;
  /** Called once the gate has admitted the ticket, with the time when known. */
  onUsed: (usedAt?: string) => void;
}

/**
 * Shows the ticket's gate code. The server issues a new signed code every 30
 * seconds, so a screenshot stops working within a minute.
 */
export const TicketQRPanel: React.FC<Props> = ({ ticketId, seatLabel, onUsed }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [qr, setQr] = useState<TicketQR | null>(null);
  const [failed, setFailed] = useState(false);
  const [left, setLeft] = useState(0);
  const usedRef = useRef(onUsed);
  usedRef.current = onUsed;

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      const res = await apiFetchTicketQR(ticketId);
      if (!alive) return;
      if (res.kind === 'used') {
        usedRef.current();
        return;
      }
      if (res.kind === 'error') {
        setFailed(true);
        timer = window.setTimeout(load, 3000);
        return;
      }
      setFailed(false);
      setQr(res.qr);
      const wait = Math.max(500, new Date(res.qr.expiresAt).getTime() - Date.now() + 200);
      timer = window.setTimeout(load, wait);
    };
    load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [ticketId]);

  // The gate's scan reaches this screen at once, not on the next code refresh.
  useEffect(() => {
    const es = new EventSource(`/api/tickets/${encodeURIComponent(ticketId)}/stream`, { withCredentials: true });
    es.addEventListener('update', e => {
      try {
        const msg = JSON.parse((e as MessageEvent).data);
        if (msg.type === 'ticket_used') usedRef.current(msg.usedAt);
      } catch {
        // Ignore a malformed message; the next code refresh still reports the ticket as used.
      }
    });
    return () => es.close();
  }, [ticketId]);

  useEffect(() => {
    if (!qr || !canvas.current) return;
    QRCode.toCanvas(canvas.current, qr.payload, { width: 248, margin: 2, errorCorrectionLevel: 'M' });
  }, [qr]);

  useEffect(() => {
    if (!qr) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [qr]);

  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-xl bg-white p-4 text-[#11121a] sm:flex-row sm:items-center sm:gap-6">
      <canvas ref={canvas} aria-label={`Mã QR vào cổng của ghế ${seatLabel}`} className="size-[248px] rounded-lg" />
      <div className="space-y-2 text-center sm:text-left">
        <p className="text-lg font-semibold">Đưa mã này cho nhân viên soát vé</p>
        {failed && !qr && <p role="alert">Đang lấy mã, kiểm tra kết nối mạng…</p>}
        {qr && (
          <>
            <p className="tabular-nums">Mã đổi sau {left} giây</p>
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-black/10" aria-hidden="true">
              <div
                className="h-full bg-[#ff8d73] transition-[width] duration-200 ease-linear"
                style={{ width: `${(left / qr.periodSec) * 100}%` }}
              />
            </div>
          </>
        )}
        <p className="max-w-xs text-sm text-black/60">Mã đổi sau mỗi 30 giây. Ảnh chụp màn hình không dùng được.</p>
      </div>
    </div>
  );
};
