"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { transportRouteService } from "@/services/transportService";
import { RouteForm } from "@/features/transport/route-form";
import type { TransportRouteInput } from "@/lib/validation/transport-route";
import type { TransportRouteDetailRecord } from "@/types/transport";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDefaultValues(route: TransportRouteDetailRecord): Partial<TransportRouteInput> {
  return {
    name: route.name,
    routeNumber: route.routeNumber ?? undefined,
    startingPoint: route.startingPoint ?? undefined,
    destination: route.destination ?? undefined,
    totalDistanceKm: route.totalDistanceKm ?? undefined,
    estimatedDurationMinutes: route.estimatedDurationMinutes ?? undefined,
    morningTiming: route.morningTiming ?? undefined,
    afternoonTiming: route.afternoonTiming ?? undefined,
    status: route.status as TransportRouteInput["status"],
  };
}

export default function EditTransportRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [route, setRoute] = useState<TransportRouteDetailRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    transportRouteService
      .get(id)
      .then((r) => {
        setRoute(r);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!route) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Transport" },
            { label: "Routes", href: "/transport/routes" },
            { label: route.name, href: `/transport/routes/${route.id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {route.name}</h1>
      </div>
      <RouteForm
        defaultValues={toDefaultValues(route)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await transportRouteService.update(route.id, input);
          toast({ title: "Route updated", variant: "success" });
          router.push(`/transport/routes/${route.id}`);
        }}
      />
    </div>
  );
}
