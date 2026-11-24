import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, ShieldCheck } from 'lucide-react';
import { UserTicket, apiFetchTicketQR } from '../../services/paymentService';

interface TicketQRCardProps {
  ticket: UserTicket;
  /** When set, renders a client-side organizer preview QR without querying /api/tickets/{id}/qr. */
  previewPayload?: string;
}

/**
 * Renders the ticket's fixed, server-signed optical QR code (or local organizer preview QR).
 */
export const TicketQRCard: React.FC<TicketQRCardProps> = ({ ticket, previewPayload }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isPreview = Boolean(previewPayload);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const resolvePayload = previewPayload
      ? Promise.resolve(previewPayload)
      : apiFetchTicketQR(ticket.id).then(res => res?.payload || ticket.ticketCode);

    resolvePayload
      .then(async payload => {
        if (!active) return;
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
  }, [ticket.id, ticket.ticketCode, previewPayload]);

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
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isPreview
                  ? 'bg-kumo-warning-tint text-kumo-warning'
                  : 'bg-kumo-success-tint text-kumo-success'
              }`}
            >
              <ShieldCheck className="size-3.5" />
              {isPreview ? 'QR mẫu kiểm thử (BTC)' : 'Mã QR vé điện tử cố định'}
            </span>
            {qrDataUrl && !isPreview && (
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
            {isPreview
              ? 'Đây là mã QR mô phỏng dành riêng cho Ban Tổ Chức kiểm thử giao diện — không lưu database và không có giá trị vào cổng.'
              : 'Mã QR cố định gắn với vé này. Bạn có thể lưu về máy hoặc xuất trình trực tiếp tại cổng soát vé.'}
          </p>
        </div>
      </div>
    </div>
  );
};
