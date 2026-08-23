"use client";

import { HelpCircle, LifeBuoy, BookOpen, Keyboard } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const links = [
  { label: "Help center", icon: LifeBuoy, href: "#" },
  { label: "Documentation", icon: BookOpen, href: "#" },
  { label: "Keyboard shortcuts", icon: Keyboard, href: "#" },
];

export function HelpMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/[.05] hover:text-foreground dark:hover:bg-white/[.06]"
          aria-label="Help"
        >
          <HelpCircle className="size-4.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
          >
            <link.icon className="size-4 text-muted-foreground" aria-hidden="true" />
            {link.label}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
