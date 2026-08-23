"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator>
        <Check className="size-3 text-white" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
