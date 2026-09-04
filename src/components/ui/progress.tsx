import { cn } from "@/lib/utils";

export interface ProgressProps {
  /** 0-100 */
  value: number;
  tone?: "primary" | "success" | "warning" | "danger";
  label?: string;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<ProgressProps["tone"]>, string> = {
  primary: "bg-primary-600",
  success: "bg-accent-600",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

/** No progress-bar primitive existed anywhere in this codebase before the WhatsApp module — campaign send progress, import progress, and any future job-style progress all use this. */
export function Progress({ value, tone = "primary", label, className }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10", className)}
    >
      <div className={cn("h-full rounded-full transition-all duration-300", TONE_CLASSES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
