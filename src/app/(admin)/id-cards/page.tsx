"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GraduationCap,
  IdCard,
  ShieldAlert,
  ShieldX,
  Users,
  UserCog,
  Clock,
  RefreshCcw,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { CardPeopleList } from "@/features/id-cards/card-people-list";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

interface IdCardStats {
  totalStudents: number;
  totalTeachers: number;
  totalStaff: number;
  cardsGenerated: number;
  cardsPending: number;
  lostCards: number;
  blockedCards: number;
  replacedCards: number;
  activeCards: number;
}

/**
 * Each figure is a way into the people behind it: clicking one opens the list
 * filtered to exactly what was counted, and each row opens that person's card.
 * `drill` is what a tile resolves to.
 */
interface Tile {
  key: keyof IdCardStats;
  label: string;
  icon: typeof Users;
  tone: "primary" | "success" | "warning" | "danger" | "neutral";
  drill?: { type?: string; cardStatus?: string };
}

const PEOPLE_TILES: Tile[] = [
  { key: "totalStudents", label: "Students", icon: Users, tone: "primary", drill: { type: "student" } },
  { key: "totalTeachers", label: "Teachers", icon: GraduationCap, tone: "primary", drill: { type: "teacher" } },
  { key: "totalStaff", label: "Other staff", icon: UserCog, tone: "primary", drill: { type: "staff" } },
];

const CARD_TILES: Tile[] = [
  {
    key: "cardsGenerated",
    label: "Cards generated",
    icon: IdCard,
    tone: "success",
    drill: { cardStatus: "generated" },
  },
  { key: "cardsPending", label: "Cards pending", icon: Clock, tone: "warning", drill: { cardStatus: "pending" } },
  { key: "lostCards", label: "Lost cards", icon: ShieldAlert, tone: "danger" },
  { key: "blockedCards", label: "Blocked cards", icon: ShieldX, tone: "danger" },
  { key: "replacedCards", label: "Replaced cards", icon: RefreshCcw, tone: "neutral" },
];

const TONE_CLASSES: Record<Tile["tone"], string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-accent-50 text-accent-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-black/5 text-muted-foreground dark:bg-white/10",
};

export default function IdCardsDashboardPage() {
  const [stats, setStats] = useState<IdCardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [drill, setDrill] = useState<{ type: string; cardStatus: string } | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/id-cards/stats")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body as IdCardStats;
      })
      .then((body) => {
        if (cancelled) return;
        setStats(body);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError((e as ApiError)?.error ?? "Couldn't load ID card statistics.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (drill) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">ID cards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone a card can be issued to. Open a row to see that person&apos;s card.
          </p>
        </div>
        <CardPeopleList
          initialType={drill.type}
          initialCardStatus={drill.cardStatus}
          onBack={() => {
            setDrill(null);
            reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">ID Card Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate, print, and track student &amp; staff ID cards for this school.
        </p>
      </div>

      {error && <ErrorState description={error} onRetry={reload} />}
      {!error && !stats && <LoadingState label="Loading stats…" />}

      {stats && (
        <>
          <section aria-label="People">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">People</h2>
            {/* Three across so the row divides evenly and tiles stay the same width. */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PEOPLE_TILES.map((tile) => (
                <StatTile key={tile.key} tile={tile} value={stats[tile.key]} onDrill={setDrill} />
              ))}
            </div>
          </section>

          <section aria-label="Cards">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Cards</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {CARD_TILES.map((tile) => (
                <StatTile key={tile.key} tile={tile} value={stats[tile.key]} onDrill={setDrill} />
              ))}
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Recent generation jobs</CardTitle>
              <CardDescription>Bulk and individual ID card generation history will appear here.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={IdCard}
                title="No ID cards generated yet"
                description="Every student and employee already appears under Cards pending — open it to preview a card, then use Generate Cards to issue them."
                className="py-10"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatTile({
  tile,
  value,
  onDrill,
}: {
  tile: Tile;
  value: number;
  onDrill: (drill: { type: string; cardStatus: string }) => void;
}) {
  const Icon = tile.icon;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tile.tone])}
          aria-hidden="true"
        >
          <Icon className="size-4.5" />
        </span>
        {tile.drill && (
          <ChevronRight
            className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-3">
        <p className="text-sm text-muted-foreground">{tile.label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    </>
  );

  // Tiles without a drill-through stay static rather than looking clickable and
  // doing nothing.
  if (!tile.drill) {
    return <div className="rounded-lg border border-border bg-surface-raised p-4">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onDrill({ type: tile.drill?.type ?? "all", cardStatus: tile.drill?.cardStatus ?? "all" })}
      className="group rounded-lg border border-border bg-surface-raised p-4 text-left transition-colors hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
    >
      {body}
    </button>
  );
}
