"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
/** Don't reset the timer on every single mousemove — once every few seconds is enough to prove "still here". */
const ACTIVITY_THROTTLE_MS = 5000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "wheel", "scroll", "touchstart"] as const;

/**
 * Signs the user out after IDLE_TIMEOUT_MS with no mouse/keyboard/touch
 * activity, redirecting to `redirectTo` with `?timeout=1` so the login form
 * can explain why. Session/cookie mechanics are shared (see
 * src/lib/session.ts) — this just decides *when* to call the same
 * POST /api/auth/logout every sign-out button already uses.
 */
export function useIdleLogout(redirectTo: string, enabled: boolean) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    async function logout() {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      router.push(`${redirectTo}?timeout=1`);
      router.refresh();
    }

    function scheduleLogout() {
      timerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS);
    }

    function handleActivity() {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      clearTimeout(timerRef.current);
      scheduleLogout();
    }

    scheduleLogout();
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, handleActivity, { passive: true });

    return () => {
      clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, handleActivity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectTo, enabled]);
}
