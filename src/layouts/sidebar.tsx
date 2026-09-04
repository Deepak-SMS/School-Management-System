"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/providers/sidebar-provider";
import { useCurrentUser } from "@/providers/user-provider";
import { getNavigationForRole } from "@/config/navigation";
import { APP_LOGO_MARK, APP_NAME } from "@/config/app";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NavSection } from "@/types/navigation";

function isSectionActive(section: NavSection, pathname: string) {
  return section.items.some((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
}

function NavRow({ href, label, icon: Icon, badge, active, collapsed }: {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10"
          : "text-muted-foreground hover:bg-black/[.04] hover:text-foreground dark:hover:bg-white/[.04]",
        collapsed && "justify-center px-0 py-2",
      )}
    >
      {Icon && <Icon className={cn("size-4 shrink-0", collapsed && "size-5")} aria-hidden="true" />}
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge !== undefined && (
        <span className="ml-auto rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

/** Expanded (>=1024px, or user-expanded tablet) sidebar: accordion of sections. */
function ExpandedNav({ sections, pathname }: { sections: NavSection[]; pathname: string }) {
  const [openTitles, setOpenTitles] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.title && isSectionActive(s, pathname)).map((s) => s.title!)),
  );

  function toggle(title: string) {
    setOpenTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-label="Primary">
      {sections.map((section, index) => {
        if (!section.title) {
          return (
            <div key={index} className="mb-1">
              {section.items.map((item) => (
                <NavRow
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                />
              ))}
            </div>
          );
        }

        const isOpen = openTitles.has(section.title);
        const SectionIcon = section.icon;
        return (
          <div key={section.title} className="mb-0.5">
            <button
              type="button"
              onClick={() => toggle(section.title!)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              aria-expanded={isOpen}
            >
              {SectionIcon && <SectionIcon className="size-3.5" aria-hidden="true" />}
              <span className="flex-1 text-left">{section.title}</span>
              <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="mt-0.5 flex flex-col gap-0.5 pl-1">
                {section.items.map((item) => (
                  <NavRow
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge}
                    active={pathname.startsWith(item.href)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Collapsed icon-rail sidebar: each section is an icon that opens a flyout with its items. */
function CollapsedNav({ sections, pathname }: { sections: NavSection[]; pathname: string }) {
  return (
    <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-3" aria-label="Primary">
      {sections.map((section, index) => {
        if (!section.title) {
          return (
            <div key={index} className="mb-1 w-full">
              {section.items.map((item) => (
                <NavRow
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                  collapsed
                />
              ))}
            </div>
          );
        }

        const SectionIcon = section.icon;
        const active = isSectionActive(section, pathname);

        return (
          <Popover key={section.title}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={section.title}
                className={cn(
                  "flex w-full items-center justify-center rounded-md py-2 text-muted-foreground transition-colors hover:bg-black/[.04] hover:text-foreground dark:hover:bg-white/[.04]",
                  active && "bg-primary-50 text-primary-700 dark:bg-primary-500/10",
                )}
              >
                {SectionIcon && <SectionIcon className="size-5" aria-hidden="true" />}
                <span className="sr-only">{section.title}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-56 p-1.5">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavRow
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge}
                    active={pathname.startsWith(item.href)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { isCollapsed } = useSidebar();
  const user = useCurrentUser();
  const pathname = usePathname();
  const sections = useMemo(() => getNavigationForRole(user.role), [user.role]);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
        isCollapsed ? "w-(--sidebar-width-collapsed)" : "w-(--sidebar-width-expanded)",
      )}
    >
      <div
        className={cn(
          "flex h-(--topnav-height) shrink-0 items-center border-b border-border px-4",
          isCollapsed && "justify-center px-0",
        )}
      >
        <Link href="/admin" className="flex items-center gap-2 overflow-hidden">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
            {APP_LOGO_MARK}
          </span>
          {!isCollapsed && <span className="truncate text-sm font-semibold text-foreground">{APP_NAME}</span>}
        </Link>
      </div>

      {isCollapsed ? (
        <CollapsedNav sections={sections} pathname={pathname} />
      ) : (
        <ExpandedNav sections={sections} pathname={pathname} />
      )}
    </aside>
  );
}

export function MobileNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const pathname = usePathname();
  const sections = useMemo(() => getNavigationForRole(user.role), [user.role]);

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) {
      onNavigate?.();
    }
  }

  return (
    <div className="flex h-full flex-col" onClickCapture={handleClickCapture}>
      <div className="flex h-(--topnav-height) shrink-0 items-center border-b border-border px-4">
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
            {APP_LOGO_MARK}
          </span>
          <span className="text-sm font-semibold text-foreground">{APP_NAME}</span>
        </span>
      </div>
      <ExpandedNav sections={sections} pathname={pathname} />
    </div>
  );
}
