"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { transportDriverService } from "@/services/transportService";
import { DriverForm } from "@/features/transport/driver-form";
import type { TransportDriverInput } from "@/lib/validation/transport-driver";
import type { TransportDriverRecord } from "@/types/transport";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDateInput(value?: string | null): string | undefined {
  return value ? value.slice(0, 10) : undefined;
}

function toDefaultValues(driver: TransportDriverRecord): Partial<TransportDriverInput> {
  return {
    staffId: driver.staffId ?? undefined,
    fullName: driver.fullName ?? undefined,
    phone: driver.phone ?? undefined,
    address: driver.address ?? undefined,
    licenseNumber: driver.licenseNumber ?? undefined,
    licenseType: driver.licenseType ?? undefined,
    licenseIssueDate: toDateInput(driver.licenseIssueDate),
    licenseExpiryDate: toDateInput(driver.licenseExpiryDate),
    policeVerificationDate: toDateInput(driver.policeVerificationDate),
    medicalCertificateExpiryDate: toDateInput(driver.medicalCertificateExpiryDate),
    status: driver.status as TransportDriverInput["status"],
  };
}

export default function EditTransportDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [driver, setDriver] = useState<TransportDriverRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    transportDriverService
      .get(id)
      .then((d) => {
        setDriver(d);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!driver) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  const driverName = driver.staff?.fullName ?? driver.fullName ?? "driver";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Drivers", href: "/transport/drivers" }, { label: driverName }, { label: "Edit" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {driverName}</h1>
      </div>
      <DriverForm
        defaultValues={toDefaultValues(driver)}
        defaultStaff={driver.staff ? { id: driver.staff.id, fullName: driver.staff.fullName, mobileNumber: driver.staff.mobileNumber } : null}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await transportDriverService.update(driver.id, input);
          toast({ title: "Driver updated", variant: "success" });
          router.push("/transport/drivers");
        }}
      />
    </div>
  );
}
