import React, { createContext, useContext, useEffect, useState } from 'react';

export type FeatureFlag =
  | 'otp_login'
  | 'seat_map_realtime'
  | 'seat_hold'
  | 'zone_pricing'
  | 'organizer_console'
  | 'ticket_limit';

interface FeatureContextType {
  isLoading: boolean;
  isEnabled: (flag: FeatureFlag) => boolean;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetched once; while loading or on failure every gated feature stays off.
  useEffect(() => {
    let isMounted = true;
    fetch('/api/features')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (isMounted && data?.features) setFeatures(data.features);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isEnabled = (flag: FeatureFlag) => features[flag] === true;

  return <FeatureContext.Provider value={{ isLoading, isEnabled }}>{children}</FeatureContext.Provider>;
};

export const useFeatures = () => {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
};
