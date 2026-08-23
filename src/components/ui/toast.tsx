"use client";

import * as RadixToast from "@radix-ui/react-toast";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToast, type ToastVariant } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border bg-surface-raised text-foreground",
  success: "border-accent-500/30 bg-surface-raised text-foreground",
  warning: "border-warning-500/30 bg-surface-raised text-foreground",
  danger: "border-danger-500/30 bg-surface-raised text-foreground",
};

const variantIcons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const iconColor: Record<ToastVariant, string> = {
  default: "text-info-500",
  success: "text-accent-500",
  warning: "text-warning-500",
  danger: "text-danger-500",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <RadixToast.Provider swipeDirection="right">
      {toasts.map(({ id, title, description, variant = "default", duration }) => {
        const Icon = variantIcons[variant];
        return (
          <RadixToast.Root
            key={id}
            duration={duration}
            onOpenChange={(open) => !open && dismiss(id)}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg [animation:toast-in_150ms_ease-out]",
              variantStyles[variant],
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor[variant])} aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <RadixToast.Title className="text-sm font-medium">{title}</RadixToast.Title>
              {description && (
                <RadixToast.Description className="text-sm text-muted-foreground">
                  {description}
                </RadixToast.Description>
              )}
            </div>
            <RadixToast.Close className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <X className="size-3.5" />
            </RadixToast.Close>
          </RadixToast.Root>
        );
      })}
      <RadixToast.Viewport className="fixed top-4 right-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
    </RadixToast.Provider>
  );
}
