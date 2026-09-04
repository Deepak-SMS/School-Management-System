"use client";

import { Sparkles, ArrowUp } from "lucide-react";
import { Reveal } from "@/features/marketing/reveal";
import { useScrollReveal } from "@/features/marketing/hooks";

export function AiSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.3);

  return (
    <section id="ai" className="border-t border-border bg-[#0b0f1a] py-24 text-white">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
            <Sparkles className="size-3.5 text-primary-400" /> AI, built into the platform
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Your school data. Now with intelligence.
          </h2>
          <p className="mt-3 text-white/60">Ask your school ERP anything — no reports to build first.</p>
        </Reveal>

        <div
          ref={ref}
          className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-2xl transition-all duration-700 ease-out"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
        >
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Sparkles className="size-4 text-primary-400" />
            <p className="text-sm font-medium text-white">School AI</p>
          </div>

          <div className="mt-4 flex justify-end">
            <p className="max-w-md rounded-2xl rounded-tr-sm bg-primary-600 px-4 py-2.5 text-sm text-white">
              Which classes have declining attendance this month?
            </p>
          </div>

          <div
            className="mt-4 max-w-lg rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3 text-sm text-white/90 transition-all duration-700 ease-out"
            style={{ opacity: visible ? 1 : 0, transitionDelay: "500ms" }}
          >
            <p>I found 3 classes requiring attention:</p>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-white/70">
              <li>Grade 8A &nbsp;↓ 6.2%</li>
              <li>Grade 9B &nbsp;↓ 4.8%</li>
              <li>Grade 7C &nbsp;↓ 3.9%</li>
            </ul>
            <p className="mt-2 text-white/70">Recommended action: send attendance alerts to their parents.</p>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40">
            Ask about attendance, fees, admissions, or staff…
            <ArrowUp className="ml-auto size-3.5 rounded-full bg-white/10 p-0.5 text-white/60" />
          </div>
        </div>
      </div>
    </section>
  );
}
