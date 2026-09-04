"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { campusService } from "@/services/campusService";
import { CampusForm } from "@/features/campuses/campus-form";
import type { CampusInput } from "@/lib/validation/campus";
import type { CampusRecord } from "@/types/campus";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDefaultValues(campus: CampusRecord): Partial<CampusInput> {
  return {
    name: campus.name,
    code: campus.code,
    campusType: campus.campusType as CampusInput["campusType"],
    headStaffId: campus.headStaffId ?? undefined,
    address: campus.address ?? undefined,
    city: campus.city ?? undefined,
    state: campus.state ?? undefined,
    country: campus.country ?? undefined,
    pinCode: campus.pinCode ?? undefined,
    phone: campus.phone ?? undefined,
    email: campus.email ?? undefined,
    website: campus.website ?? undefined,
    studentCapacity: campus.studentCapacity ?? undefined,
    staffCapacity: campus.staffCapacity ?? undefined,
    status: campus.status as CampusInput["status"],
  };
}

export default function EditCampusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campus, setCampus] = useState<CampusRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    campusService
      .get(id)
      .then((c) => {
        setCampus(c);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!campus) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Campuses", href: "/school/campuses" },
            { label: campus.name, href: `/school/campuses/${id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {campus.name}</h1>
      </div>
      <CampusForm
        defaultValues={toDefaultValues(campus)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await campusService.update(id, input);
          toast({ title: "Campus updated", variant: "success" });
          router.push(`/school/campuses/${id}`);
        }}
      />
    </div>
  );
}
