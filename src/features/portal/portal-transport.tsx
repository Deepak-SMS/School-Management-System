"use client";

import { useEffect, useState } from "react";
import { Bus, MapPin, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useActiveChild } from "@/providers/active-child-provider";
import { portalService } from "@/services/portalService";
import type { PortalTransport } from "@/types/portal";

export function PortalTransportView() {
  const { activeChild, isLoading: childLoading } = useActiveChild();
  const [transport, setTransport] = useState<PortalTransport | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeChild) return;
    setLoading(true);
    setError(null);
    portalService
      .getTransport(activeChild.id)
      .then((r) => setTransport(r.data))
      .catch(() => setError("Couldn't load transport details."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (childLoading) return;
    const timeout = setTimeout(() => {
      if (!activeChild) {
        setLoading(false);
        return;
      }
      load();
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id, childLoading]);

  if (childLoading || loading) return <LoadingState />;
  if (!activeChild) return <EmptyState title="No student linked to this account yet" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  if (!transport) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <EmptyState icon={Bus} title="No transport enrollment on file" description={`${activeChild.firstName} isn't currently enrolled in school transport.`} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Transport</h1>
        <p className="mt-1 text-sm text-muted-foreground">{activeChild.firstName}&apos;s route.</p>
      </div>

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/10">
            <Bus className="size-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {transport.route.name}
              {transport.route.routeNumber ? ` (${transport.route.routeNumber})` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {transport.vehicle ? `${transport.vehicle.vehicleType} · ${transport.vehicle.vehicleNumber}` : "Vehicle not yet assigned"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 border-t border-border pt-4">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="text-foreground">Pickup: {transport.pickupStop.name}</p>
            {transport.dropStop && <p className="text-foreground">Drop: {transport.dropStop.name}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {transport.route.morningTiming ?? ""}
              {transport.route.afternoonTiming ? ` · ${transport.route.afternoonTiming}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <User className="size-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="text-foreground">{transport.driver?.fullName ?? "Driver not yet assigned"}</p>
            {transport.driver?.phone && <p className="text-xs text-muted-foreground">{transport.driver.phone}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
