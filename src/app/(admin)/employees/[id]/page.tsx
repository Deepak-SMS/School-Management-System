"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { staffService } from "@/services/staffService";
import type { StaffRecord } from "@/types/staff";
import type { StaffInput } from "@/lib/validation/staff";
import { STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import { StaffForm } from "@/features/staff/staff-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

interface StaffWithQr extends StaffRecord {
  qrVerification?: { code: string } | null;
}

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [staff, setStaff] = useState<StaffWithQr | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);

  function load() {
    staffService
      .get(id)
      .then((s) => setStaff(s as StaffWithQr))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!staff) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  if (editing) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <h1 className="text-xl font-semibold text-foreground">Edit {staff.fullName}</h1>
        <StaffForm
          submitLabel="Save changes"
          defaultValues={{
            employeeId: staff.employeeId,
            fullName: staff.fullName,
            photoUrl: staff.photoUrl ?? undefined,
            dateOfBirth: staff.dateOfBirth?.slice(0, 10),
            gender: staff.gender as StaffInput["gender"],
            bloodGroup: staff.bloodGroup as StaffInput["bloodGroup"],
            designation: staff.designation,
            departmentId: staff.departmentId ?? undefined,
            category: staff.category as StaffInput["category"],
            mobileNumber: staff.mobileNumber,
            email: staff.email ?? undefined,
            emergencyContact: staff.emergencyContact ?? undefined,
            address: staff.address ?? undefined,
            joiningDate: staff.joiningDate?.slice(0, 10),
            employeeType: staff.employeeType as StaffInput["employeeType"],
            employmentStatus: staff.employmentStatus as StaffInput["employmentStatus"],
          }}
          onSubmit={async (input) => {
            await staffService.update(id, input);
            toast({ title: "Staff member updated", variant: "success" });
            setEditing(false);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <Link href="/employees" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to employees
      </Link>

      <div className="flex items-center gap-4">
        <Avatar initials={staff.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")} size="lg" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{staff.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {staff.employeeId} · {STAFF_CATEGORY_LABELS[staff.category as keyof typeof STAFF_CATEGORY_LABELS] ?? staff.category}
          </p>
        </div>
        <Badge variant={staff.employmentStatus === "active" ? "success" : "neutral"}>{staff.employmentStatus}</Badge>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Field label="Designation" value={staff.designation} />
          <Field label="Department" value={staff.department?.name} />
          <Field label="Mobile" value={staff.mobileNumber} />
          <Field label="Email" value={staff.email} />
          <Field label="Joining date" value={staff.joiningDate?.slice(0, 10)} />
          <Field label="Blood group" value={staff.bloodGroup} />
        </CardContent>
      </Card>

      {staff.qrVerification && (
        <Card>
          <CardHeader>
            <CardTitle>Verification identifier</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-accent-600" aria-hidden="true" />
            <div>
              <p className="font-mono font-medium text-foreground">VERIFY-{staff.qrVerification.code}</p>
              <p className="text-muted-foreground">
                Generated automatically — this is what the ID card&apos;s QR code will encode once cards are generated.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
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
