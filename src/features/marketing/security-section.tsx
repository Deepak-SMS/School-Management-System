"use client";

import { ShieldCheck, KeyRound, ScrollText, DatabaseBackup, Lock } from "lucide-react";
import { Reveal } from "@/features/marketing/reveal";

const SECURITY_ITEMS = [
  { icon: KeyRound, label: "Role-based access", description: "Thirteen distinct roles, enforced on the server — never just a hidden button." },
  { icon: Lock, label: "Secure authentication", description: "Hashed credentials and session-based sign-in, with forced password resets." },
  { icon: ScrollText, label: "Audit logs", description: "Every sensitive change is attributable — who did what, and when." },
  { icon: DatabaseBackup, label: "Data isolation", description: "Every school's data is scoped and walled off from every other school." },
];

export function SecuritySection() {
  return (
    <section className="border-t border-border bg-[#0b0f1a] py-24 text-white">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
            <ShieldCheck className="size-3.5 text-primary-400" /> Security
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Built for sensitive school data.</h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {SECURITY_ITEMS.map((item, i) => (
            <Reveal key={item.label} delayMs={i * 80}>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-primary-300">
                  <item.icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-white">{item.label}</p>
                  <p className="mt-1 text-sm text-white/60">{item.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
