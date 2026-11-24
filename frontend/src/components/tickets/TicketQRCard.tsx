import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, ShieldCheck } from 'lucide-react';
import { UserTicket, apiFetchTicketQR } from '../../services/paymentService';

interface TicketQRCardProps {
  ticket: UserTicket;
}

/**
 * Renders the ticket's fixed, server-signed optical QR code.
 */
export const TicketQRCard: React.FC<TicketQRCardProps> = ({ ticket }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiFetchTicketQR(ticket.id)
      .then(async res => {
        if (!active) return;
        const payload = res?.payload || ticket.ticketCode;
        const url = await QRCode.toDataURL(payload, {
          width: 248,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#11121a', light: '#ffffff' }
        });
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setError('Không tạo được mã QR.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticket.id, ticket.ticketCode]);

  return (
    <div className="rounded-2xl bg-stage p-4 ring ring-stage-line sm:p-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0 rounded-2xl bg-white p-3 shadow-sm">
          {loading && !qrDataUrl ? (
            <div className="grid size-44 place-items-center text-xs text-midnight/60">
              Đang tạo mã QR…
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Mã QR vé ${ticket.ticketCode} ghế ${ticket.seatLabel}`}
              className="size-44 rounded-lg"
            />
          ) : (
            <div className="grid size-44 place-items-center px-3 text-center text-xs text-red-700">
              {error ?? 'Chưa tải được QR'}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-kumo-success-tint px-2.5 py-1 text-xs font-semibold text-kumo-success">
              <ShieldCheck className="size-3.5" />
              Mã QR vé điện tử cố định
            </span>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`${ticket.ticketCode}-${ticket.seatLabel}.png`}
                className="inline-flex items-center gap-1 rounded-full bg-stage-raised px-2.5 py-1 text-xs font-medium text-stage-ink ring ring-stage-line transition-colors hover:bg-kumo-tint"
              >
                <Download className="size-3" />
                Tải mã QR
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-stage-raised/80 px-3 py-2">
              <span className="block text-[11px] text-stage-muted">Mã vé</span>
              <span className="type-figure text-sm text-stage-ink">{ticket.ticketCode}</span>
            </div>
            <div className="rounded-lg bg-stage-raised/80 px-3 py-2">
              <span className="block text-[11px] text-stage-muted">Vị trí ghế</span>
              <span className="type-figure text-sm text-spot">{ticket.seatLabel}</span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-kumo-danger">
              {error}
            </p>
          )}

          <p className="rounded-xl bg-stage-raised/70 px-3 py-2 text-xs leading-relaxed text-stage-muted">
            Mã QR cố định gắn với vé này. Bạn có thể lưu về máy hoặc xuất trình trực tiếp tại cổng soát vé.
          </p>
        </div>
      </div>
    </div>
  );
};
