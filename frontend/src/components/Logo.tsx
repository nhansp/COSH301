import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
}

/** Stage-spotlight mark: an ink disc with a punched-out spot. */
export const LogoMark: React.FC<{ className?: string }> = ({ className = 'size-7' }) => (
  <span
    aria-hidden="true"
    className={`relative grid place-items-center rounded-full bg-kumo-contrast ${className}`}
  >
    <span className="size-[42%] rounded-full ring-[1.5px] ring-kumo-canvas/40" />
    <span className="absolute size-[18%] rounded-full bg-kumo-canvas" />
  </span>
);

export const Logo: React.FC<LogoProps> = ({ className = '' }) => (
  <Link
    to="/"
    className={`inline-flex items-center gap-2 rounded-md text-kumo-strong ${className}`}
  >
    <LogoMark />
    <span className="text-lg font-semibold tracking-tight">SortMyScene</span>
  </Link>
);
