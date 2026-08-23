"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Drawer = RadixDialog.Root;
export const DrawerTrigger = RadixDialog.Trigger;
export const DrawerClose = RadixDialog.Close;

interface DrawerContentProps extends React.ComponentProps<typeof RadixDialog.Content> {
  side?: "left" | "right";
  title?: string;
  hideTitle?: boolean;
  widthClassName?: string;
}

export function DrawerContent({
  className,
  children,
  side = "left",
  title = "Navigation",
  hideTitle = true,
  widthClassName = "w-72",
  ...props
}: DrawerContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <RadixDialog.Content
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col bg-surface-raised shadow-xl outline-none",
          side === "left" ? "left-0 border-r border-border" : "right-0 border-l border-border",
          widthClassName,
          className,
        )}
        {...props}
      >
        <RadixDialog.Title className={cn(hideTitle && "sr-only")}>{title}</RadixDialog.Title>
        <RadixDialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </RadixDialog.Close>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
