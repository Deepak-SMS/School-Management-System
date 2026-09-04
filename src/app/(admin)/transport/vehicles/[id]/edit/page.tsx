"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { transportVehicleService } from "@/services/transportService";
import { VehicleForm } from "@/features/transport/vehicle-form";
import type { TransportVehicleInput } from "@/lib/validation/transport-vehicle";
import type { TransportVehicleRecord } from "@/types/transport";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDefaultValues(vehicle: TransportVehicleRecord): Partial<TransportVehicleInput> {
  return {
    vehicleNumber: vehicle.vehicleNumber,
    vehicleType: vehicle.vehicleType as TransportVehicleInput["vehicleType"],
    make: vehicle.make ?? undefined,
    modelName: vehicle.modelName ?? undefined,
    manufacturingYear: vehicle.manufacturingYear ?? undefined,
    seatingCapacity: vehicle.seatingCapacity ?? undefined,
    standingCapacity: vehicle.standingCapacity ?? undefined,
    fuelType: (vehicle.fuelType as TransportVehicleInput["fuelType"]) ?? undefined,
    color: vehicle.color ?? undefined,
    gpsDeviceId: vehicle.gpsDeviceId ?? undefined,
    status: vehicle.status as TransportVehicleInput["status"],
  };
}

export default function EditTransportVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [vehicle, setVehicle] = useState<TransportVehicleRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    transportVehicleService
      .get(id)
      .then((v) => {
        setVehicle(v);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!vehicle) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Transport" },
            { label: "Vehicles", href: "/transport/vehicles" },
            { label: vehicle.vehicleNumber, href: `/transport/vehicles/${vehicle.id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {vehicle.vehicleNumber}</h1>
      </div>
      <VehicleForm
        defaultValues={toDefaultValues(vehicle)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await transportVehicleService.update(vehicle.id, input);
          toast({ title: "Vehicle updated", variant: "success" });
          router.push(`/transport/vehicles/${vehicle.id}`);
        }}
      />
    </div>
  );
}
