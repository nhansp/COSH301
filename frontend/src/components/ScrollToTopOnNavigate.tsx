import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Ensures that whenever a route navigation occurs, the scroll position
 * resets cleanly to the top of the new page.
 */
export const ScrollToTopOnNavigate: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  }, [pathname]);

  return null;
};
