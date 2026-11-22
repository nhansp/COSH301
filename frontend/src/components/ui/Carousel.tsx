import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselProps {
  /** Accessible name of the list, also the section heading's id target. */
  label: string;
  children: React.ReactNode[];
  /** Heading block shown left of the arrows. */
  header?: React.ReactNode;
  /** Slide width per breakpoint, as utility classes. */
  itemClassName?: string;
}

/**
 * A row that scrolls sideways with snap points. Touch and trackpad scroll it natively; the buttons
 * page it by one view and grey out at either end.
 */
export const Carousel: React.FC<CarouselProps> = ({ label, children, header, itemClassName = 'w-[78%] sm:w-[46%] lg:w-[calc((100%-3.75rem)/4)]' }) => {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, children.length]);

  const page = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reduce ? 'auto' : 'smooth' });
  };

  const arrows = atStart && atEnd ? null : (
    <div className="flex gap-2">
      <button type="button" onClick={() => page(-1)} disabled={atStart} aria-label="Xem các đêm diễn trước" className="btn-icon ring ring-kumo-line disabled:opacity-30">
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" onClick={() => page(1)} disabled={atEnd} aria-label="Xem các đêm diễn tiếp theo" className="btn-icon ring ring-kumo-line disabled:opacity-30">
        <ChevronRight className="size-5" />
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div className="min-w-0">{header}</div>
        {arrows && <div className="hidden shrink-0 sm:block">{arrows}</div>}
      </div>
      <ul
        ref={track}
        onScroll={update}
        aria-label={label}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {React.Children.map(children, child => (
          <li className={`shrink-0 snap-start ${itemClassName}`}>{child}</li>
        ))}
      </ul>
    </div>
  );
};
