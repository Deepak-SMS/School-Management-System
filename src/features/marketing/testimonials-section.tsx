"use client";

import { Quote } from "lucide-react";
import { Reveal } from "@/features/marketing/reveal";

/** Placeholder copy only — swap for real quotes once you have customers. Deliberately labeled "Sample" rather than presented as genuine. */
const SAMPLE_QUOTES = [
  { quote: "We moved off spreadsheets and a dozen group chats onto one system. Our office finally has one place to look.", role: "Principal, sample school" },
  { quote: "Payroll used to take a full day every month. Now it's a couple of hours.", role: "Accountant, sample school" },
  { quote: "Parents stopped calling the front office for attendance updates — it's just in the app now.", role: "School Admin, sample school" },
];

export function TestimonialsSection() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">What schools could say</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Sample quotes — placeholders until real schools are live on the platform.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {SAMPLE_QUOTES.map((t, i) => (
            <Reveal key={t.role} delayMs={i * 100}>
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-border-strong bg-surface p-6 shadow-sm">
                <Quote className="size-5 text-primary-500/60" />
                <p className="flex-1 text-sm text-foreground">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-xs font-medium text-muted-foreground">{t.role}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
