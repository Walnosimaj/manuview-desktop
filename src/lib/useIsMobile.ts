import { useState, useEffect } from "react";

/**
 * Responsive viewport detection hook calibrated for mobile, tablet, and desktop breakpoints.
 * Follows iOS / Apple Human Interface Guidelines:
 * - Mobile: < 768px (iPhone / Android phones)
 * - Tablet: 768px - 1024px (iPad / Android tablets)
 * - Desktop: >= 1024px
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Immediate check
    handleResize();

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [breakpoint]);

  return isMobile;
}
