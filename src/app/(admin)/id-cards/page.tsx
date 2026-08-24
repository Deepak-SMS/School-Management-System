"use client";

import { useEffect, useState } from "react";
import { GraduationCap, IdCard, ShieldAlert, ShieldX, Users, UserCog, Clock, RefreshCcw } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

interface IdCardStats {
  totalStudents: number;
  totalStaff: number;
  totalTeachers: number;
  cardsGenerated: number;
  cardsPending: number;
  lostCards: number;
  blockedCards: number;
  replacedCards: number;
  activeCards: number;
}

export default function IdCardsDashboardPage() {
  const [stats, setStats] = useState<IdCardStats | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    fetch("/api/id-cards/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setError(true));
  }

  useEffect(() => {
    fetch("/api/id-cards/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">ID Card Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate, print, and track student &amp; staff ID cards for this school.
        </p>
      </div>

      {error && <ErrorState onRetry={load} />}
      {!error && !stats && <LoadingState label="Loading stats…" />}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total students" value={stats.totalStudents} icon={Users} tone="primary" />
            <StatCard label="Teachers" value={stats.totalTeachers} icon={GraduationCap} tone="primary" />
            <StatCard label="Other staff" value={stats.totalStaff} icon={UserCog} tone="primary" />
            <StatCard label="Cards generated" value={stats.cardsGenerated} icon={IdCard} tone="success" />
            <StatCard label="Cards pending" value={stats.cardsPending} icon={Clock} tone="warning" />
            <StatCard label="Lost cards" value={stats.lostCards} icon={ShieldAlert} tone="danger" />
            <StatCard label="Blocked cards" value={stats.blockedCards} icon={ShieldX} tone="danger" />
            <StatCard label="Replaced cards" value={stats.replacedCards} icon={RefreshCcw} tone="neutral" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent generation jobs</CardTitle>
              <CardDescription>Bulk and individual ID card generation history will appear here.</CardDescription>
            </CardHeader>
            <EmptyState
              icon={IdCard}
              title="No ID cards generated yet"
              description="Create a template and run your first generation job to see history here. Templates, the card designer, and PDF generation ship in the next phases of this module."
              className="py-12"
            />
          </Card>
        </>
      )}
    </div>
  );
}
