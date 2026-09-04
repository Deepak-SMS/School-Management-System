"use client";

import { Users, ClipboardCheck, Wallet, GraduationCap, Sparkles, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCountUp } from "@/features/marketing/hooks";

/**
 * A realistic ERP dashboard built from real design-system primitives (Card/Badge),
 * not a screenshot or illustration — reused in the hero and the product showcase.
 * `active` gates the count-up so numbers only animate once the section is visible.
 */
export function MockDashboard({ active, className }: { active: boolean; className?: string }) {
  const students = useCountUp(1248, active);
  const attendance = useCountUp(948, active); // /10 for one decimal
  const fees = useCountUp(246, active); // in lakhs *10 for one decimal
  const teachers = useCountUp(86, active);

  return (
    <Card className={`overflow-hidden border-border-strong bg-surface shadow-xl ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border bg-background/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-danger-500/70" />
          <span className="size-2.5 rounded-full bg-warning-500/70" />
          <span className="size-2.5 rounded-full bg-accent-500/70" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">School Dashboard · Today</p>
        <Bell className="size-4 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5" />
            <span className="text-[11px] font-medium">Students</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{students.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ClipboardCheck className="size-3.5" />
            <span className="text-[11px] font-medium">Attendance</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{(attendance / 10).toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Wallet className="size-3.5" />
            <span className="text-[11px] font-medium">Fees Collected</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">₹{(fees / 10).toFixed(1)}L</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <GraduationCap className="size-3.5" />
            <span className="text-[11px] font-medium">Teachers</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{teachers}</p>
        </div>
      </div>

      <div className="flex items-end gap-1.5 px-5 pb-2">
        {[38, 52, 44, 61, 58, 72, 66, 80, 74, 91, 84, 96].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-primary-500/70 transition-all duration-700 ease-out"
            style={{ height: active ? `${h}px` : "4px", transitionDelay: `${i * 40}ms` }}
          />
        ))}
      </div>

      <div className="border-t border-border bg-background/60 p-4">
        <div className="flex items-start gap-2 rounded-lg border border-primary-500/20 bg-primary-50 p-3 dark:bg-primary-500/10">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary-600" />
          <div>
            <p className="text-xs font-medium text-foreground">AI Insight</p>
            <p className="text-xs text-muted-foreground">Attendance in Grade 8A dropped 6% this month — 12 students crossed the alert threshold.</p>
          </div>
          <Badge variant="warning" className="ml-auto shrink-0">
            New
          </Badge>
        </div>
      </div>
    </Card>
  );
}
