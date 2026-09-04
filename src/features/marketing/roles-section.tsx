"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Reveal } from "@/features/marketing/reveal";
import { cn } from "@/lib/utils";

const ROLES = [
  { key: "admin", label: "School Admin", items: ["School-wide dashboard", "Admissions & students", "Fees & finance", "HR & payroll", "Reports & analytics"] },
  { key: "teacher", label: "Teacher", items: ["My classes & subjects", "Attendance", "Marks & report cards", "Timetable", "Assignments"] },
  { key: "parent", label: "Parent", items: ["Child's attendance", "Fees & payments", "Exam results", "Announcements", "Transport tracking"] },
  { key: "student", label: "Student", items: ["Timetable", "Assignments", "Exam results", "Attendance", "Library"] },
  { key: "accountant", label: "Accountant", items: ["Fee structures", "Payments & receipts", "Outstanding balances", "Expense tracking"] },
  { key: "hr", label: "HR", items: ["Employee records", "Recruitment pipeline", "Leave & attendance", "Payroll"] },
  { key: "super_admin", label: "Super Admin", items: ["Every school on the platform", "Subscriptions & plans", "Module access per school", "Platform-wide audit log"] },
];

export function RolesSection() {
  const [active, setActive] = useState(ROLES[0].key);
  const current = ROLES.find((r) => r.key === active) ?? ROLES[0];

  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">One platform. Every person connected.</h2>
          <p className="mt-3 text-muted-foreground">Thirteen roles, each server-enforced — never just a hidden button.</p>
        </Reveal>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => setActive(role.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                active === role.key
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-border-strong text-muted-foreground hover:border-primary-500/40 hover:text-foreground",
              )}
            >
              {role.label}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border-strong bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{current.label} sees</p>
          <ul className="mt-4 flex flex-col gap-3">
            {current.items.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                <Check className="size-4 shrink-0 text-accent-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
