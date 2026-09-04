"use client";

import { useRouter } from "next/navigation";
import { transportStopService } from "@/services/transportService";
import { StopForm } from "@/features/transport/stop-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewTransportStopPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Stops", href: "/transport/stops" }, { label: "Add Stop" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Stop</h1>
      </div>
      <StopForm
        onSubmit={async (input) => {
          await transportStopService.create(input);
          toast({ title: "Stop added", variant: "success" });
          router.push("/transport/stops");
        }}
      />
    </div>
  );
}
