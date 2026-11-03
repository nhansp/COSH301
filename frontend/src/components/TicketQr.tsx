import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface TicketQrProps {
  /** Booking code the gate scanner reads, e.g. SMS-920861. */
  code: string;
  className?: string;
}

/**
 * Renders the ticket QR in the browser. It encodes only the booking code:
 * there is no public ticket page to link to, and generating it locally keeps
 * codes off third-party QR services. Always black on white for scanners.
 */
export const TicketQr: React.FC<TicketQrProps> = ({ code, className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    QRCode.toString(code, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    })
      .then(svg => {
        if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed) {
    return (
      <div role="img" aria-label={`Mã vé ${code}`} className={`grid place-items-center text-center text-sm font-semibold text-black tabular-nums ${className}`}>
        {code}
      </div>
    );
  }

  return src ? (
    <img src={src} alt={`Mã QR vé ${code}`} className={className} />
  ) : (
    <div aria-hidden="true" className={`animate-pulse rounded bg-neutral-200 ${className}`} />
  );
};
