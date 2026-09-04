"use client";

import { ArrowDown } from "lucide-react";
import { useScrollReveal } from "@/features/marketing/hooks";
import { Reveal } from "@/features/marketing/reveal";

const SCATTERED_TOOLS = [
  { label: "Excel Sheets", rotate: -6, x: -6 },
  { label: "WhatsApp Groups", rotate: 4, x: 4 },
  { label: "Paper Registers", rotate: -3, x: -2 },
  { label: "Fee Software", rotate: 5, x: 6 },
  { label: "Attendance Register", rotate: -5, x: -4 },
  { label: "HR Files", rotate: 3, x: 3 },
  { label: "Exam Sheets", rotate: -4, x: -3 },
];

export function ProblemSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.3);

  return (
    <section className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            Your school doesn&apos;t have a software problem.
            <br />
            It has a connectivity problem.
          </h2>
        </Reveal>

        <div ref={ref} className="mt-16 flex flex-wrap items-center justify-center gap-3">
          {SCATTERED_TOOLS.map((tool, i) => (
            <span
              key={tool.label}
              className="rounded-full border border-border-strong bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-all duration-700 ease-out"
              style={{
                transform: visible ? "rotate(0deg) translateX(0)" : `rotate(${tool.rotate}deg) translateX(${tool.x}%)`,
                opacity: visible ? 1 : 0.55,
                transitionDelay: `${i * 60}ms`,
              }}
            >
              {tool.label}
            </span>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <ArrowDown
            className="size-6 text-muted-foreground transition-all duration-700"
            style={{ opacity: visible ? 1 : 0, transitionDelay: "500ms" }}
          />
        </div>

        <div
          className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-primary-500/30 bg-primary-50 px-8 py-5 shadow-lg transition-all duration-700 ease-out dark:bg-primary-500/10"
          style={{
            transform: visible ? "scale(1)" : "scale(0.9)",
            opacity: visible ? 1 : 0,
            transitionDelay: "600ms",
          }}
        >
          <p className="text-lg font-semibold tracking-tight text-primary-700 dark:text-primary-300">
            ONE SCHOOL OPERATING SYSTEM
          </p>
        </div>
      </div>
    </section>
  );
}
