"use client";

import { useRouter } from "next/navigation";
import { transportRouteService } from "@/services/transportService";
import { RouteForm } from "@/features/transport/route-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewTransportRoutePage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Routes", href: "/transport/routes" }, { label: "Add Route" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Route</h1>
      </div>
      <RouteForm
        onSubmit={async (input) => {
          const route = await transportRouteService.create(input);
          toast({ title: "Route added", variant: "success" });
          router.push(`/transport/routes/${route.id}`);
        }}
      />
    </div>
  );
}
