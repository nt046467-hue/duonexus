"use client";

import { useState, useEffect } from "react";

export interface ViewportState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  isMounted: boolean;
}

export function useViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>({
    isMobile: true, // Default safe mobile-first for SSR
    isTablet: false,
    isDesktop: false,
    width: 0,
    isMounted: false,
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setState({
        isMobile: w < 768,
        isTablet: w >= 768 && w < 1024,
        isDesktop: w >= 1024,
        width: w,
        isMounted: true,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return state;
}
