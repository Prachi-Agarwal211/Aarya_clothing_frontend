'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const IntroVideoOverlayContext = createContext({
  introOverlayActive: false,
  setIntroOverlayActive: () => {},
});

/**
 * While the full-screen intro is mounted, storefront chrome (e.g. mobile bottom nav)
 * should stay hidden so it does not stack above the video (root layout uses z-10 for
 * main content vs z-[100] for the nav).
 */
export function IntroVideoOverlayProvider({ children }) {
  const [introOverlayActive, setIntroOverlayActive] = useState(false);
  const setActive = useCallback((v) => {
    setIntroOverlayActive(Boolean(v));
  }, []);

  const value = useMemo(
    () => ({ introOverlayActive, setIntroOverlayActive: setActive }),
    [introOverlayActive, setActive]
  );

  return (
    <IntroVideoOverlayContext.Provider value={value}>
      {children}
    </IntroVideoOverlayContext.Provider>
  );
}

export function useIntroVideoOverlay() {
  return useContext(IntroVideoOverlayContext);
}
