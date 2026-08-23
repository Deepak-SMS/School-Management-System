"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Modal = RadixDialog.Root;
export const ModalTrigger = RadixDialog.Trigger;
export const ModalClose = RadixDialog.Close;

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface ModalContentProps extends React.ComponentProps<typeof RadixDialog.Content> {
  size?: keyof typeof sizeClasses;
  title: string;
  description?: string;
  hideTitle?: boolean;
}

export function ModalContent({ className, children, size = "md", title, description, hideTitle, ...props }: ModalContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface-raised shadow-xl outline-none",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <RadixDialog.Title className={cn("text-sm font-semibold text-foreground", hideTitle && "sr-only")}>
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary-500/40 dark:hover:bg-white/5">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </RadixDialog.Close>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-border px-5 py-3", className)} {...props} />;
}
