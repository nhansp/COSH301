import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
}

/** Stage-spotlight mark: a soothing emerald disc with a punched-out spotlight. */
export const LogoMark: React.FC<{ className?: string }> = ({ className = 'size-7' }) => (
  <span
    aria-hidden="true"
    className={`relative grid place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm shadow-emerald-600/20 transition-transform group-hover:scale-105 ${className}`}
  >
    <span className="size-[44%] rounded-full ring-[1.5px] ring-white/70" />
    <span className="absolute size-[18%] rounded-full bg-white shadow-xs" />
  </span>
);

export const Logo: React.FC<LogoProps> = ({ className = '' }) => (
  <Link
    to="/"
    className={`inline-flex items-center gap-2.5 rounded-md text-kumo-strong group transition-colors ${className}`}
  >
    <LogoMark />
    <span className="text-lg font-bold tracking-tight">
      Sort<span className="text-emerald-600 dark:text-emerald-400">My</span>Scene
    </span>
  </Link>
);
