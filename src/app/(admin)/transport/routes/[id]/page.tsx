"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, MapPin, Users, Clock } from "lucide-react";
import { transportRouteService } from "@/services/transportService";
import type { TransportRouteDetailRecord } from "@/types/transport";
import { ROUTE_STATUS_LABELS } from "@/lib/constants/transport";
import { useCan } from "@/hooks/use-can";
import { RouteStopsPanel } from "@/features/transport/route-stops-panel";
import { RouteAssignmentPanel } from "@/features/transport/route-assignment-panel";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

export default function TransportRouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const [route, setRoute] = useState<TransportRouteDetailRecord | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    transportRouteService
      .get(id)
      .then((r) => {
        setRoute(r);
        setError(false);
      })
      .catch(() => setError(true));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!route) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Routes", href: "/transport/routes" }, { label: route.name }]} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{route.name}</h1>
            <Badge variant={route.status === "active" ? "success" : "neutral"}>
              {ROUTE_STATUS_LABELS[route.status as keyof typeof ROUTE_STATUS_LABELS] ?? route.status}
            </Badge>
          </div>
          {can("transportRoutes", "edit") && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/transport/routes/${route.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[route.startingPoint, route.destination].filter(Boolean).join(" → ") || "No starting point / destination set"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Stops" value={route.stops.length} icon={MapPin} />
        <StatCard label="Students" value={route.counts?.students ?? 0} icon={Users} />
        <StatCard label="Timing" value={[route.morningTiming, route.afternoonTiming].filter(Boolean).join(" / ") || "—"} icon={Clock} />
      </div>

      <Tabs defaultValue="stops">
        <TabsList>
          <TabsTrigger value="stops">Stops</TabsTrigger>
          <TabsTrigger value="assignment">Vehicle &amp; Driver</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="stops">
          <RouteStopsPanel routeId={route.id} stops={route.stops} onChanged={load} />
        </TabsContent>

        <TabsContent value="assignment">
          <RouteAssignmentPanel routeId={route.id} currentAssignment={route.currentAssignment ?? null} history={route.assignmentHistory} onChanged={load} />
        </TabsContent>

        <TabsContent value="details" className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Route number" value={route.routeNumber} />
          <Field label="Total distance" value={route.totalDistanceKm != null ? `${route.totalDistanceKm} km` : undefined} />
          <Field label="Estimated duration" value={route.estimatedDurationMinutes != null ? `${route.estimatedDurationMinutes} minutes` : undefined} />
          <Field label="Morning timing" value={route.morningTiming} />
          <Field label="Afternoon timing" value={route.afternoonTiming} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
