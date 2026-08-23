import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  description?: string;
  className?: string;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "bg-black/5 text-foreground dark:bg-white/10",
  primary: "bg-primary-50 text-primary-700 dark:text-primary-300",
  success: "bg-accent-50 text-accent-700",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
};

export function StatCard({ label, value, icon: Icon, tone = "primary", description, className }: StatCardProps) {
  return (
    <Card className={cn("flex items-start gap-3 p-4", className)}>
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", toneClasses[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
    </Card>
  );
}
