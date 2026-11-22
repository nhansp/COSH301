import React, { useEffect, useRef, useState } from 'react';

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface HoldTimerProps {
  secondsLeft: number;
  className?: string;
  /** `stage` sits on the dark venue background. */
  tone?: 'page' | 'stage';
}

/** Hold countdown. Announces once when a minute is left, not every tick. */
export const HoldTimer: React.FC<HoldTimerProps> = ({ secondsLeft, className = '', tone = 'page' }) => {
  const urgent = secondsLeft < 60;
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef(false);

  useEffect(() => {
    if (urgent && !announced.current) {
      announced.current = true;
      setAnnouncement('Còn dưới 1 phút giữ chỗ.');
    }
    if (!urgent) announced.current = false;
  }, [urgent]);

  const base = tone === 'stage' ? 'text-stage-ink' : 'text-kumo-strong';
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className={`text-sm ${tone === 'stage' ? 'text-stage-muted' : 'text-kumo-subtle'}`}>Giữ chỗ còn</span>
      <span
        className={`font-display text-xl font-bold tabular-nums [font-stretch:68%] ${urgent ? 'text-seat-held' : base}`}
        aria-label={`${Math.floor(secondsLeft / 60)} phút ${secondsLeft % 60} giây`}
      >
        {formatClock(secondsLeft)}
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </span>
  );
};
