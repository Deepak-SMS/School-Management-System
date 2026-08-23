import type { LucideIcon } from "lucide-react";
import type { Role } from "./user";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Roles allowed to see this item. Omit to allow all authenticated roles. */
  roles?: Role[];
  badge?: string | number;
}

export interface NavSection {
  /** Section heading, e.g. "SCHOOL MANAGEMENT". Omitted for ungrouped top-level items. */
  title?: string;
  icon?: LucideIcon;
  items: NavItem[];
  roles?: Role[];
}
