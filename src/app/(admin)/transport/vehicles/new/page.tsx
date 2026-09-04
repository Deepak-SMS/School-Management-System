"use client";

import { useRouter } from "next/navigation";
import { transportVehicleService } from "@/services/transportService";
import { VehicleForm } from "@/features/transport/vehicle-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewTransportVehiclePage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Transport" },
            { label: "Vehicles", href: "/transport/vehicles" },
            { label: "Add Vehicle" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Vehicle</h1>
      </div>
      <VehicleForm
        onSubmit={async (input) => {
          const vehicle = await transportVehicleService.create(input);
          toast({ title: "Vehicle added", variant: "success" });
          router.push(`/transport/vehicles/${vehicle.id}`);
        }}
      />
    </div>
  );
}
