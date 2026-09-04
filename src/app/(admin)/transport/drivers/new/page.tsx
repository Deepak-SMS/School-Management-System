"use client";

import { useRouter } from "next/navigation";
import { transportDriverService } from "@/services/transportService";
import { DriverForm } from "@/features/transport/driver-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewTransportDriverPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Drivers", href: "/transport/drivers" }, { label: "Add Driver" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Driver</h1>
      </div>
      <DriverForm
        onSubmit={async (input) => {
          await transportDriverService.create(input);
          toast({ title: "Driver added", variant: "success" });
          router.push("/transport/drivers");
        }}
      />
    </div>
  );
}
