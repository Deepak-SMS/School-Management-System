"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { transportVehicleService } from "@/services/transportService";
import type { TransportVehicleRecord } from "@/types/transport";
import { VEHICLE_TYPE_LABELS, FUEL_TYPE_LABELS, VEHICLE_STATUS_LABELS } from "@/lib/constants/transport";
import { useCan } from "@/hooks/use-can";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  active: "success",
  in_service: "success",
  maintenance: "warning",
  inactive: "neutral",
  retired: "danger",
};

export default function TransportVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const [vehicle, setVehicle] = useState<TransportVehicleRecord | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    transportVehicleService
      .get(id)
      .then((v) => {
        setVehicle(v);
        setError(false);
      })
      .catch(() => setError(true));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!vehicle) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Transport" },
            { label: "Vehicles", href: "/transport/vehicles" },
            { label: vehicle.vehicleNumber },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{vehicle.vehicleNumber}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[vehicle.status] ?? "neutral"}>
              {VEHICLE_STATUS_LABELS[vehicle.status as keyof typeof VEHICLE_STATUS_LABELS] ?? vehicle.status}
            </Badge>
          </div>
          {can("transportVehicles", "edit") && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/transport/vehicles/${vehicle.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {VEHICLE_TYPE_LABELS[vehicle.vehicleType as keyof typeof VEHICLE_TYPE_LABELS] ?? vehicle.vehicleType}
          {[vehicle.make, vehicle.modelName].filter(Boolean).length > 0
            ? ` · ${[vehicle.make, vehicle.modelName].filter(Boolean).join(" ")}`
            : ""}
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-2">
          <Field label="Manufacturing year" value={vehicle.manufacturingYear ? String(vehicle.manufacturingYear) : undefined} />
          <Field label="Color" value={vehicle.color} />
          <Field label="Seating capacity" value={vehicle.seatingCapacity ? String(vehicle.seatingCapacity) : undefined} />
          <Field label="Standing capacity" value={vehicle.standingCapacity ? String(vehicle.standingCapacity) : undefined} />
          <Field
            label="Fuel type"
            value={vehicle.fuelType ? FUEL_TYPE_LABELS[vehicle.fuelType as keyof typeof FUEL_TYPE_LABELS] ?? vehicle.fuelType : undefined}
          />
          <Field label="GPS device ID" value={vehicle.gpsDeviceId} />
        </CardContent>
      </Card>
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
