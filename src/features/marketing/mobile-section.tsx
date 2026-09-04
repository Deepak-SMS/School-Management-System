"use client";

import { ClipboardCheck, Wallet, CalendarClock, Bell } from "lucide-react";
import { Reveal } from "@/features/marketing/reveal";
import { useScrollReveal } from "@/features/marketing/hooks";

export function MobileSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.25);

  return (
    <section className="border-t border-border bg-surface py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            The school doesn&apos;t stop when the office closes.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Parents and students get a scoped, mobile-friendly view — attendance, fees, timetable and announcements,
            without needing the full admin console.
          </p>
        </Reveal>

        <div
          ref={ref}
          className="mx-auto w-full max-w-[260px] transition-all duration-700 ease-out"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}
        >
          <div className="rounded-[2.25rem] border-8 border-[#111827] bg-[#111827] shadow-2xl">
            <div className="overflow-hidden rounded-[1.5rem] bg-background">
              <div className="flex items-center justify-between px-4 pt-4 text-[10px] font-medium text-muted-foreground">
                <span>9:41</span>
                <Bell className="size-3" />
              </div>
              <div className="px-4 pb-6 pt-3">
                <p className="text-xs text-muted-foreground">Good morning,</p>
                <p className="text-sm font-semibold text-foreground">Rahul Sharma</p>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-500/10">
                      <ClipboardCheck className="size-4" />
                    </span>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Attendance</p>
                      <p className="text-xs font-semibold text-foreground">94% this month</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
                      <Wallet className="size-4" />
                    </span>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Fees due</p>
                      <p className="text-xs font-semibold text-foreground">₹4,500 by 12 Sep</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                      <CalendarClock className="size-4" />
                    </span>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Next class</p>
                      <p className="text-xs font-semibold text-foreground">Mathematics · 9:40 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
