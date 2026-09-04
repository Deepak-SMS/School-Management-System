"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getPlatformNavigation } from "@/config/navigation";
import { APP_LOGO_MARK, APP_NAME } from "@/config/app";

function NavRow({ href, label, icon: Icon, active }: {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10"
          : "text-muted-foreground hover:bg-black/[.04] hover:text-foreground dark:hover:bg-white/[.04]",
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function PlatformNavList({ pathname }: { pathname: string }) {
  const sections = getPlatformNavigation();
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-label="Platform">
      {sections.map((section, index) => (
        <div key={index} className="mb-1">
          {section.items.map((item) => (
            <NavRow
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={item.href === "/super-admin" ? pathname === "/super-admin" : pathname.startsWith(item.href)}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function BrandMark() {
  return (
    <Link href="/super-admin" className="flex items-center gap-2 overflow-hidden">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
        {APP_LOGO_MARK}
      </span>
      <span className="flex flex-col truncate leading-tight">
        <span className="truncate text-sm font-semibold text-foreground">{APP_NAME}</span>
        <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Platform
        </span>
      </span>
    </Link>
  );
}

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-(--sidebar-width-expanded) shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-(--topnav-height) shrink-0 items-center border-b border-border px-4">
        <BrandMark />
      </div>
      <PlatformNavList pathname={pathname} />
    </aside>
  );
}

export function PlatformMobileNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) {
      onNavigate?.();
    }
  }

  return (
    <div className="flex h-full flex-col" onClickCapture={handleClickCapture}>
      <div className="flex h-(--topnav-height) shrink-0 items-center border-b border-border px-4">
        <BrandMark />
      </div>
      <PlatformNavList pathname={pathname} />
    </div>
  );
}
