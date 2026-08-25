"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { studentService } from "@/services/studentService";
import type { StudentRecord } from "@/types/student";
import type { StudentInput } from "@/lib/validation/student";
import { StudentForm } from "@/features/students/student-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

interface StudentWithQr extends StudentRecord {
  qrVerification?: { code: string } | null;
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<StudentWithQr | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);

  function load() {
    studentService
      .get(id)
      .then((s) => setStudent(s as StudentWithQr))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!student) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  // The flagged main contact, else whoever is listed first.
  const primaryGuardian = student.guardians?.find((g) => g.isPrimary) ?? student.guardians?.[0];

  if (editing) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit {student.firstName} {student.lastName}
          </h1>
        </div>
        <StudentForm
          submitLabel="Save changes"
          defaultValues={{
            admissionNumber: student.admissionNumber,
            firstName: student.firstName,
            middleName: student.middleName ?? undefined,
            lastName: student.lastName,
            photoUrl: student.photoUrl ?? undefined,
            dateOfBirth: student.dateOfBirth?.slice(0, 10),
            gender: student.gender as StudentInput["gender"],
            bloodGroup: student.bloodGroup as StudentInput["bloodGroup"],
            academicYearId: student.academicYear.id,
            classId: student.class.id,
            sectionId: student.section?.id,
            rollNumber: student.rollNumber ?? undefined,
            house: student.house ?? undefined,
            status: student.status as StudentInput["status"],
            enrollmentNumber: student.enrollmentNumber ?? undefined,
            nationality: student.nationality ?? undefined,
            motherTongue: student.motherTongue ?? undefined,
            category: student.category ?? undefined,
            religion: student.religion ?? undefined,
            govtIdRef: student.govtIdRef ?? undefined,
            previousSchool: student.previousSchool ?? undefined,
            previousClass: student.previousClass ?? undefined,
            admissionDate: student.admissionDate?.slice(0, 10),
            admissionType: student.admissionType as StudentInput["admissionType"],
            stream: student.stream ?? undefined,
            medium: student.medium ?? undefined,
            promotionStatus: student.promotionStatus as StudentInput["promotionStatus"],
            emergencyName: student.emergencyName ?? undefined,
            emergencyRelation: student.emergencyRelation ?? undefined,
            emergencyContact: student.emergencyContact ?? undefined,
            emergencyAltPhone: student.emergencyAltPhone ?? undefined,
            emergencyAddress: student.emergencyAddress ?? undefined,
            address: student.address ?? undefined,
            addressLine2: student.addressLine2 ?? undefined,
            city: student.city ?? undefined,
            district: student.district ?? undefined,
            state: student.state ?? undefined,
            country: student.country ?? undefined,
            pinCode: student.pinCode ?? undefined,
            sameAsCurrent: student.sameAsCurrent ?? true,
            permanentAddress: student.permanentAddress ?? undefined,
            permanentCity: student.permanentCity ?? undefined,
            permanentDistrict: student.permanentDistrict ?? undefined,
            permanentState: student.permanentState ?? undefined,
            permanentPinCode: student.permanentPinCode ?? undefined,
            primaryMobile: student.primaryMobile ?? undefined,
            secondaryMobile: student.secondaryMobile ?? undefined,
            studentEmail: student.studentEmail ?? undefined,
            parentEmail: student.parentEmail ?? undefined,
            whatsappNumber: student.whatsappNumber ?? undefined,
            busNumber: student.busNumber ?? undefined,
            route: student.route ?? undefined,
            pickupPoint: student.pickupPoint ?? undefined,
            // Existing guardians, so an edit doesn't silently wipe them.
            guardians: student.guardians?.map((g) => ({
              relationship: g.relationship as "father",
              fullName: g.guardian.fullName,
              mobile: g.guardian.mobile ?? undefined,
              email: g.guardian.email ?? undefined,
              occupation: g.guardian.occupation ?? undefined,
              organization: g.guardian.organization ?? undefined,
              education: g.guardian.education ?? undefined,
              isPrimary: g.isPrimary,
              isEmergencyContact: g.isEmergencyContact,
              isAuthorizedPickup: g.isAuthorizedPickup,
              canReceiveFee: g.canReceiveFee,
            })),
          }}
          mode="edit"
          onSubmit={async (input) => {
            await studentService.update(id, input);
            toast({ title: "Student updated", variant: "success" });
            setEditing(false);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <Link href="/students" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to students
      </Link>

      <div className="flex items-center gap-4">
        <Avatar initials={`${student.firstName[0]}${student.lastName[0]}`} size="lg" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {student.firstName} {student.middleName ? `${student.middleName} ` : ""}
            {student.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {student.admissionNumber} · {student.class.name}
            {student.section ? `-${student.section.name}` : ""}
          </p>
        </div>
        <Badge variant={student.status === "active" ? "success" : "neutral"}>{student.status}</Badge>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Field label="Roll number" value={student.rollNumber} />
          <Field label="House" value={student.house} />
          <Field label="Gender" value={student.gender} />
          <Field label="Blood group" value={student.bloodGroup} />
          <Field label="Date of birth" value={student.dateOfBirth?.slice(0, 10)} />
          <Field label="Academic year" value={student.academicYear.label} />
          {/* Guardians are their own records now; the primary contact is shown
              here and the full list sits in the Guardians card below. */}
          <Field label="Main contact" value={primaryGuardian?.guardian.fullName} />
          <Field label="Contact phone" value={primaryGuardian?.guardian.mobile} />
          <Field label="Emergency contact" value={student.emergencyContact} />
          <Field label="City" value={student.city} />
          <Field label="Bus number" value={student.busNumber} />
          <Field label="Route" value={student.route} />
        </CardContent>
      </Card>

      {student.qrVerification && (
        <Card>
          <CardHeader>
            <CardTitle>Verification identifier</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-accent-600" aria-hidden="true" />
            <div>
              <p className="font-mono font-medium text-foreground">VERIFY-{student.qrVerification.code}</p>
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
