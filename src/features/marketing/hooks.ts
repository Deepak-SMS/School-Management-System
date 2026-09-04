"use client";

import { useEffect, useRef, useState } from "react";

/** Fires once when the element first enters the viewport — the basis for every scroll-reveal effect on the landing page (no GSAP/ScrollTrigger dependency needed for a single fade/slide-in). */
export function useScrollReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const timeout = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timeout);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/** Animates a number from 0 to `target` once `start` becomes true — used for hero/stat counters. Respects prefers-reduced-motion by jumping straight to the target. */
export function useCountUp(target: number, start: boolean, durationMs = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      const timeout = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(timeout);
    }
    let frame: number;
    const startTime = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, target, durationMs]);

  return value;
}
