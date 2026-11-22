import React, { useEffect } from 'react';

/**
 * - `editorial`: paper surfaces that follow the visitor's light/dark choice (discovery pages).
 * - `stage`: midnight surfaces whatever the choice, for buying and holding tickets.
 */
export type PageTone = 'editorial' | 'stage';

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: PageTone;
}

/** The outer frame of every route: sets the tone for everything inside, including dialogs and toasts. */
export const PageShell: React.FC<PageShellProps> = ({ tone = 'editorial', className = '', children, ...rest }) => {
  useEffect(() => {
    if (tone !== 'stage') return;
    document.body.dataset.tone = 'stage';
    return () => {
      delete document.body.dataset.tone;
    };
  }, [tone]);

  return (
    <div
      {...rest}
      data-mode={tone === 'stage' ? 'dark' : undefined}
      data-tone={tone}
      className={`flex min-h-dvh flex-col bg-kumo-canvas text-kumo-default ${className}`}
    >
      {children}
    </div>
  );
};
