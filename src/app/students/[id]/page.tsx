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
            ...student,
            sectionId: student.section?.id,
            classId: student.class.id,
            academicYearId: student.academicYear.id,
            dateOfBirth: student.dateOfBirth?.slice(0, 10),
            gender: student.gender as StudentInput["gender"],
            bloodGroup: student.bloodGroup as StudentInput["bloodGroup"],
            status: student.status as StudentInput["status"],
          }}
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
          <Field label="Guardian" value={student.guardianName} />
          <Field label="Guardian phone" value={student.guardianPhone} />
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
                Generated automatically — this is what the ID card's QR code will encode once cards are generated.
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
