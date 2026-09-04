"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useActiveChild } from "@/providers/active-child-provider";

/** Lets a parent with more than one portal-visible child switch which one every widget is about. Hidden entirely for a single child (including every student login, who only ever has themself). */
export function ChildSwitcher() {
  const { children, activeChild, setActiveChildId, isLoading } = useActiveChild();

  if (isLoading || children.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-2 py-1 text-sm transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04]"
        >
          <Avatar initials={`${activeChild?.firstName[0] ?? ""}${activeChild?.lastName[0] ?? ""}`} size="sm" />
          <span className="max-w-[10rem] truncate font-medium text-foreground">
            {activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : "Select child"}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuRadioGroup value={activeChild?.id} onValueChange={setActiveChildId}>
          {children.map((child) => (
            <DropdownMenuRadioItem key={child.id} value={child.id}>
              <div className="flex flex-col">
                <span>
                  {child.firstName} {child.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {child.className}
                  {child.sectionName ? ` ${child.sectionName}` : ""}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
