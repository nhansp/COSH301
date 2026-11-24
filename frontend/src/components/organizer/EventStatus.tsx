import React from 'react';
import { CircleDot, CirclePause, CircleSlash, CircleCheck, FilePen, Ticket } from 'lucide-react';

export const EVENT_STATUSES = ['DRAFT', 'ON_SALE', 'PAUSED', 'SOLD_OUT', 'ENDED', 'CANCELLED'] as const;

const STATUS: Record<string, { label: string; tint: string; text: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Bản nháp', tint: 'bg-kumo-tint', text: 'text-kumo-default', icon: <FilePen className="size-3.5" /> },
  ON_SALE: { label: 'Đang mở bán', tint: 'bg-kumo-success-tint', text: 'text-kumo-success', icon: <Ticket className="size-3.5" /> },
  PAUSED: { label: 'Tạm dừng bán', tint: 'bg-kumo-warning-tint', text: 'text-kumo-warning', icon: <CirclePause className="size-3.5" /> },
  SOLD_OUT: { label: 'Hết vé', tint: 'bg-kumo-info-tint', text: 'text-kumo-info', icon: <CircleDot className="size-3.5" /> },
  ENDED: { label: 'Đã kết thúc bán', tint: 'bg-kumo-tint', text: 'text-kumo-subtle', icon: <CircleCheck className="size-3.5" /> },
  CANCELLED: { label: 'Đã hủy', tint: 'bg-kumo-danger-tint', text: 'text-kumo-danger', icon: <CircleSlash className="size-3.5" /> }
};

export const statusLabel = (status: string) => STATUS[status]?.label ?? status;

/**
 * The sale status set by the organizer, always with an icon and a label.
 * `onImage` puts it on a solid surface so it stays readable over a photo.
 */
export const EventStatusBadge: React.FC<{ status: string; onImage?: boolean; className?: string }> = ({ status, onImage = false, className = '' }) => {
  const s = STATUS[status] ?? { label: status, tint: 'bg-kumo-tint', text: 'text-kumo-default', icon: null };
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${onImage ? 'bg-kumo-raised shadow-sm' : s.tint} ${s.text} ${className}`}>
      {s.icon}
      {s.label}
    </span>
  );
};

/** Whether the show itself is ahead, under way or over, from its dates. */
export function timingOf(startsAt: string, endsAt: string, now = Date.now()): { label: string; past: boolean } {
  if (now < Date.parse(startsAt)) return { label: 'Sắp diễn ra', past: false };
  if (now <= Date.parse(endsAt)) return { label: 'Đang diễn ra', past: false };
  return { label: 'Đã diễn ra', past: true };
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
