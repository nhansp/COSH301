import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
  /** Where the logo leads: the schedule for customers, the dashboard for staff. */
  to?: string;
}

/** A dark stage with the followspot landing on it: the coral spot is the one place colour sits. */
export const LogoMark: React.FC<{ className?: string }> = ({ className = 'size-7' }) => (
  <span aria-hidden="true" className={`relative inline-block shrink-0 rounded-full bg-kumo-contrast ${className}`}>
    <span className="absolute top-[20%] right-[18%] size-[36%] rounded-full bg-coral" />
  </span>
);

export const Logo: React.FC<LogoProps> = ({ className = '', to = '/' }) => (
  <Link to={to} aria-label="COSH301 Concerts, về trang chủ" className={`inline-flex items-center gap-2.5 rounded-md text-kumo-strong ${className}`}>
    <LogoMark />
    <span className="font-display text-xl leading-none font-bold tracking-[-0.045em]">COSH301 Concerts</span>
  </Link>
);
