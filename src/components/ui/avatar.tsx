"use client";

import * as RadixAvatar from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

interface AvatarProps {
  initials: string;
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
};

export function Avatar({ initials, src, alt, size = "md", className }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 font-medium text-primary-700 select-none",
        sizeClasses[size],
        className,
      )}
    >
      {src && <RadixAvatar.Image src={src} alt={alt ?? ""} className="h-full w-full object-cover" />}
      <RadixAvatar.Fallback delayMs={src ? 400 : 0}>{initials}</RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
