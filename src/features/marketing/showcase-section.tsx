"use client";

import {
  LayoutDashboard,
  Users,
  UserPlus,
  BookOpenCheck,
  ClipboardCheck,
  ClipboardList,
  Wallet,
  UserCog,
  Bus,
  Library,
  MessagesSquare,
  BarChart3,
  Settings,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { MockDashboard } from "@/features/marketing/mock-dashboard";
import { Reveal } from "@/features/marketing/reveal";
import { useScrollReveal } from "@/features/marketing/hooks";

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Students" },
  { icon: UserPlus, label: "Admissions" },
  { icon: BookOpenCheck, label: "Academics" },
  { icon: ClipboardCheck, label: "Attendance" },
  { icon: ClipboardList, label: "Exams" },
  { icon: Wallet, label: "Fees" },
  { icon: UserCog, label: "HR" },
  { icon: Bus, label: "Transport" },
  { icon: Library, label: "Library" },
  { icon: MessagesSquare, label: "Communication" },
  { icon: BarChart3, label: "Reports" },
  { icon: Settings, label: "Settings" },
];

export function ShowcaseSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.15);

  return (
    <section id="platform" className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">See your school. In one screen.</h2>
          <p className="mt-3 text-muted-foreground">The same shell every role signs into — just scoped to what they&apos;re allowed to see.</p>
        </Reveal>

        <div
          ref={ref}
          className="mt-12 transition-all duration-700 ease-out"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)" }}
        >
          <Card className="overflow-hidden border-border-strong shadow-2xl">
            <div className="flex">
              <aside className="hidden w-48 shrink-0 flex-col gap-0.5 border-r border-border bg-background p-3 sm:flex">
                {SIDEBAR_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                      item.active ? "bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </div>
                ))}
              </aside>
              <div className="flex-1 bg-background p-4">
                <MockDashboard active={visible} className="shadow-none" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
