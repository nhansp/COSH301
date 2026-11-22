import React from 'react';

interface EmptyStateProps {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  /** `alert` for failures, so assistive technology announces them. */
  role?: 'alert' | 'status';
  className?: string;
}

/** Nothing to show: says why in one line and offers the next step. */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, body, action, role, className = '' }) => (
  <div role={role} className={`border-y border-kumo-hairline py-14 ${className}`}>
    <p className="type-display text-title">{title}</p>
    {body && <p className="mt-2 max-w-prose text-kumo-subtle">{body}</p>}
    {action && <div className="mt-6 flex flex-wrap gap-3">{action}</div>}
  </div>
);
