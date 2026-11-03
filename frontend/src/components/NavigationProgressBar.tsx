import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const NavigationProgressBar: React.FC = () => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Trigger progress animation on route change
    setIsVisible(true);
    setProgress(30);

    const t1 = setTimeout(() => {
      setProgress(75);
    }, 80);

    const t2 = setTimeout(() => {
      setProgress(100);
    }, 200);

    const t3 = setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
    }, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname, location.search]);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '150ms' : '220ms',
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
};
