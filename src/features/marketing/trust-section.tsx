"use client";

import { useScrollReveal, useCountUp } from "@/features/marketing/hooks";
import { Reveal } from "@/features/marketing/reveal";

const STATS = [
  { value: 500, suffix: "+", label: "Students managed" },
  { value: 20, suffix: "+", label: "Operational modules" },
  { value: 24, suffix: "/7", label: "Cloud access" },
  { value: 100, suffix: "%", label: "Centralized data" },
];

function StatBlock({ value, suffix, label, active }: { value: number; suffix: string; label: string; active: boolean }) {
  const count = useCountUp(value, active);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
        {count}
        {suffix}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function TrustSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();

  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Designed for schools of every size
          </p>
        </Reveal>
        <div ref={ref} className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((stat) => (
            <StatBlock key={stat.label} {...stat} active={visible} />
          ))}
        </div>
      </div>
    </section>
  );
}
