import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { InventoryNotice } from '../../hooks/useSeatInventory';

const TONE = {
  error: { icon: AlertCircle, className: 'text-kumo-danger' },
  success: { icon: CheckCircle2, className: 'text-kumo-success' },
  info: { icon: Info, className: 'text-kumo-subtle' }
};

export const NoticeToast: React.FC<{ notice: InventoryNotice | null; onDismiss: () => void }> = ({ notice, onDismiss }) => {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, notice.tone === 'error' ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  const tone = notice ? TONE[notice.tone] : null;
  return (
    <div aria-live="polite" style={{ zIndex: 'var(--z-toast)' }} className="pointer-events-none fixed inset-x-4 top-20 flex justify-center">
      {notice && tone && (
        <div
          key={notice.id}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-kumo-raised py-3 pr-2 pl-4 text-base text-kumo-strong shadow-[var(--shadow-pop)] ring ring-kumo-line motion-safe:animate-[notice-in_240ms_var(--ease-reveal)]"
        >
          <tone.icon className={`mt-0.5 size-4 shrink-0 ${tone.className}`} />
          <span className="min-w-0 flex-1">{notice.text}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng thông báo"
            className="-my-1 grid size-8 shrink-0 place-items-center rounded-md text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
};
