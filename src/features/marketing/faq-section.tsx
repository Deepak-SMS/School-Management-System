"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/features/marketing/reveal";
import { cn } from "@/lib/utils";

const FAQS = [
  { q: "Can the system support multiple schools?", a: "Yes — it's built as a multi-tenant platform. A Super Admin can onboard any number of schools, each with its own isolated data." },
  { q: "Can parents have their own login?", a: "Yes, parents and students each get a scoped login that only shows what belongs to their own child." },
  { q: "Can teachers mark attendance?", a: "Yes, for the classes and subjects they're actually assigned to — enforced on the server, not just hidden in the UI." },
  { q: "Can administrators edit submitted attendance?", a: "Yes, subject to their role's permissions, and every change is recorded in the audit log." },
  { q: "Can we import existing student data?", a: "Yes, through structured Excel/CSV imports with row-level validation before anything is committed." },
  { q: "Does the system support AI?", a: "Yes — AI features are built in for attendance/fee insights and natural-language questions over your school's own data." },
  { q: "Is the system cloud based?", a: "Yes, entirely — there's nothing to install, and every school accesses it from a browser." },
  { q: "Can module access be customized per school?", a: "Yes, a Super Admin can toggle which modules each school's plan includes." },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Frequently asked questions</h2>
        </Reveal>

        <div className="mt-10 flex flex-col divide-y divide-border rounded-2xl border border-border-strong bg-background">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-foreground">{faq.q}</span>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
                </button>
                <div
                  className="grid overflow-hidden transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-4 text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
