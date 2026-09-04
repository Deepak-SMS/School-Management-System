"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { transportStopService } from "@/services/transportService";
import { StopForm } from "@/features/transport/stop-form";
import type { TransportStopInput } from "@/lib/validation/transport-stop";
import type { TransportStopRecord } from "@/types/transport";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDefaultValues(stop: TransportStopRecord): Partial<TransportStopInput> {
  return {
    name: stop.name,
    code: stop.code ?? undefined,
    address: stop.address ?? undefined,
    landmark: stop.landmark ?? undefined,
    latitude: stop.latitude ?? undefined,
    longitude: stop.longitude ?? undefined,
    distanceFromSchool: stop.distanceFromSchool ?? undefined,
    status: stop.status as TransportStopInput["status"],
  };
}

export default function EditTransportStopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [stop, setStop] = useState<TransportStopRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    transportStopService
      .get(id)
      .then((s) => {
        setStop(s);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!stop) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[{ label: "Transport" }, { label: "Stops", href: "/transport/stops" }, { label: stop.name }, { label: "Edit" }]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {stop.name}</h1>
      </div>
      <StopForm
        defaultValues={toDefaultValues(stop)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await transportStopService.update(stop.id, input);
          toast({ title: "Stop updated", variant: "success" });
          router.push("/transport/stops");
        }}
      />
    </div>
  );
}
