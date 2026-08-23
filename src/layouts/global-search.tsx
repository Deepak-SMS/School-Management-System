"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/providers/user-provider";
import { getNavigationForRole } from "@/config/navigation";

export function GlobalSearch() {
  const user = useCurrentUser();
  const sections = useMemo(() => getNavigationForRole(user.role), [user.role]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return sections
      .flatMap((section) => section.items.map((item) => ({ ...item, section: section.title ?? "General" })))
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [sections, query]);

  return (
    <Popover open={open && results.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-sm">
          <Input
            leadingIcon={<Search />}
            placeholder="Search students, classes, fees…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            aria-label="Global search"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {results.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-primary-50 hover:text-primary-700"
          >
            <span>{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.section}</span>
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}
