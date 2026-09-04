"use client";

import { useScrollReveal } from "@/features/marketing/hooks";
import { cn } from "@/lib/utils";

/** Fades + slides an element up the first time it scrolls into view. The one animation primitive the whole landing page is built from — used with restraint, not on every element. */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out", visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", className)}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
