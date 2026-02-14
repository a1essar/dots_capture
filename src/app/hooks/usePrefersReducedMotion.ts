/**
 * Returns true when the user has requested reduced motion (system preference).
 * Used to respect prefers-reduced-motion for animations.
 */

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      setPrefers(false);
      return;
    }
    const mq = window.matchMedia(QUERY);
    setPrefers(mq.matches);
    const handler = () => setPrefers(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefers;
}
