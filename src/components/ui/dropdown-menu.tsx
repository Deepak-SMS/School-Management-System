"use client";

import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;
export const DropdownMenuGroup = RadixDropdown.Group;
export const DropdownMenuSub = RadixDropdown.Sub;
export const DropdownMenuRadioGroup = RadixDropdown.RadioGroup;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof RadixDropdown.Content>) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-lg",
          className,
        )}
        {...props}
      />
    </RadixDropdown.Portal>
  );
}

export function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof RadixDropdown.Item> & { inset?: boolean }) {
  return (
    <RadixDropdown.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-7",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof RadixDropdown.CheckboxItem>) {
  return (
    <RadixDropdown.CheckboxItem
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-sm text-foreground outline-none data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700",
        className,
      )}
      checked={checked}
      {...props}
    >
      <RadixDropdown.ItemIndicator className="absolute left-2 flex items-center">
        <Check className="size-3.5" />
      </RadixDropdown.ItemIndicator>
      {children}
    </RadixDropdown.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof RadixDropdown.RadioItem>) {
  return (
    <RadixDropdown.RadioItem
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-sm text-foreground outline-none data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700",
        className,
      )}
      {...props}
    >
      <RadixDropdown.ItemIndicator className="absolute left-2 flex items-center">
        <Circle className="size-2 fill-current" />
      </RadixDropdown.ItemIndicator>
      {children}
    </RadixDropdown.RadioItem>
  );
}

export function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof RadixDropdown.Label> & { inset?: boolean }) {
  return (
    <RadixDropdown.Label
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", inset && "pl-7", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof RadixDropdown.Separator>) {
  return <RadixDropdown.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
}

export const DropdownMenuSubTrigger = RadixDropdown.SubTrigger;
export function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof RadixDropdown.SubContent>) {
  return (
    <RadixDropdown.SubContent
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-lg",
        className,
      )}
      {...props}
    />
  );
}
export { ChevronRight as DropdownMenuSubTriggerIcon };
