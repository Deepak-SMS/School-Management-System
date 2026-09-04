"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Library, CheckCircle2, Tags, ArrowRight } from "lucide-react";
import { libraryStatsService } from "@/services/libraryService";
import type { LibraryStatsRecord } from "@/types/library";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TILES: { key: keyof LibraryStatsRecord; label: string; icon: typeof BookOpen; tone: "primary" | "success" | "warning" | "danger" }[] = [
  { key: "totalTitles", label: "Total titles", icon: Library, tone: "primary" },
  { key: "totalBooks", label: "Total copies", icon: BookOpen, tone: "primary" },
  { key: "available", label: "Available", icon: CheckCircle2, tone: "success" },
  { key: "totalCategories", label: "Categories", icon: Tags, tone: "warning" },
];

const TONE_CLASSES: Record<string, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-accent-50 text-accent-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
};

export default function LibraryDashboardPage() {
  const [stats, setStats] = useState<LibraryStatsRecord | null>(null);

  useEffect(() => {
    libraryStatsService.get().then(setStats).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Catalogue, physical copies, and library configuration.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card key={tile.key}>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className={cn("flex size-10 items-center justify-center rounded-lg", TONE_CLASSES[tile.tone])}>
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{stats ? stats[tile.key] : "—"}</p>
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stats && (stats.issued > 0 || stats.reserved > 0 || stats.lost > 0 || stats.damaged > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniStat label="Issued" value={stats.issued} />
          <MiniStat label="Reserved" value={stats.reserved} />
          <MiniStat label="Lost / Damaged" value={stats.lost + stats.damaged} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/library/catalogue" title="Catalogue" description="Browse, search, and add book titles and categories." />
        <QuickLink href="/library/catalogue/new" title="Add Book" description="Catalogue a new title and generate copies for it." />
        <QuickLink href="/library/settings" title="Settings" description="Borrowing limits, renewals, and fine rules." />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href}>
          <Button variant="secondary" size="sm">
            Open <ArrowRight className="size-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
