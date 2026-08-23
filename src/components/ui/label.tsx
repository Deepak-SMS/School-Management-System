"use client";

import * as RadixLabel from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<typeof RadixLabel.Root>) {
  return (
    <RadixLabel.Root
      className={cn("text-sm font-medium text-foreground data-[disabled]:opacity-50", className)}
      {...props}
    />
  );
}
