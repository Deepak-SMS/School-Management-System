"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

export function PopoverContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-lg border border-border bg-surface-raised shadow-lg outline-none",
          className,
        )}
        {...props}
      />
    </RadixPopover.Portal>
  );
}
