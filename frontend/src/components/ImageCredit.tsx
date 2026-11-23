import React from 'react';

/** Attribution required by the CC licences of the event photos (see public/events/CREDITS.md). */
export const ImageCredit: React.FC<{ credit?: string; className?: string }> = ({ credit, className = '' }) =>
  credit ? <p className={`text-xs ${className}`}>{credit}</p> : null;
