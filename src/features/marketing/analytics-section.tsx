"use client";

import { Reveal } from "@/features/marketing/reveal";
import { useScrollReveal } from "@/features/marketing/hooks";

const METRICS = [
  { label: "Attendance", value: 94 },
  { label: "Fee collection", value: 81 },
  { label: "Academic performance", value: 88 },
  { label: "Teacher attendance", value: 95 },
];

export function AnalyticsSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.3);

  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Turn school data into better decisions.
          </h2>
          <p className="mt-3 text-muted-foreground">Your school, understood in real time.</p>
        </Reveal>

        <div ref={ref} className="mx-auto mt-12 flex max-w-lg flex-col gap-5">
          {METRICS.map((metric, i) => (
            <div key={metric.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{metric.label}</span>
                <span className="tabular-nums text-muted-foreground">{visible ? metric.value : 0}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-1000 ease-out"
                  style={{ width: visible ? `${metric.value}%` : "0%", transitionDelay: `${i * 100}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
