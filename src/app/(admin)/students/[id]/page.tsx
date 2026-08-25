"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, FileText, ShieldCheck } from "lucide-react";
import { studentService } from "@/services/studentService";
import type { StudentDocumentRecord, StudentGuardianRef, StudentRecord } from "@/types/student";
import type { StudentInput } from "@/lib/validation/student";
import {
  ADMISSION_TYPE_LABELS,
  PROMOTION_STATUS_LABELS,
  STUDENT_DOCUMENT_LABELS,
} from "@/lib/constants/student-documents";
import { StudentForm } from "@/features/students/student-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

interface StudentWithQr extends StudentRecord {
  qrVerification?: { code: string } | null;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  father: "Father",
  mother: "Mother",
  guardian: "Guardian",
  grandfather: "Grandfather",
  grandmother: "Grandmother",
  sibling: "Sibling",
  other: "Other",
};

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<StudentWithQr | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);

  // Two levels of progressive disclosure: the overview is what you almost always
  // want, the full record is a click away, and documents are a click past that
  // because they cost a second request.
  const [showAll, setShowAll] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [documents, setDocuments] = useState<StudentDocumentRecord[] | null>(null);
  const [documentsError, setDocumentsError] = useState(false);

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

  function loadDocuments() {
    setDocumentsError(false);
    studentService
      .listDocuments(id)
      .then((r) => setDocuments(r.data))
      .catch(() => setDocumentsError(true));
  }

  function toggleDocuments() {
    const next = !showDocuments;
    setShowDocuments(next);
    // Fetched once, on first open — reopening reuses what we already have.
    if (next && documents === null && !documentsError) loadDocuments();
  }

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!student) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  // The flagged main contact, else whoever is listed first.
  const primaryGuardian = student.guardians?.find((g) => g.isPrimary) ?? student.guardians?.[0];

  if (editing) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {student.firstName}&apos;s profile
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit {student.firstName} {student.lastName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {student.admissionNumber} · {student.class.name}
            {student.section ? `-${student.section.name}` : ""} — pick any step to jump straight to it.
          </p>
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

      <div className="flex justify-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAll((open) => !open)}
          aria-expanded={showAll}
          aria-controls="student-all-details"
        >
          {showAll ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {showAll ? "Hide details" : "Show all details"}
        </Button>
      </div>

      {showAll && (
        <div id="student-all-details" className="flex flex-col gap-6">
          <Section title="Student information">
            <Field label="First name" value={student.firstName} />
            <Field label="Middle name" value={student.middleName} />
            <Field label="Last name" value={student.lastName} />
            <Field label="Date of birth" value={student.dateOfBirth?.slice(0, 10)} />
            <Field label="Gender" value={student.gender} />
            <Field label="Blood group" value={student.bloodGroup} />
            <Field label="Nationality" value={student.nationality} />
            <Field label="Mother tongue" value={student.motherTongue} />
            <Field label="Category" value={student.category} />
            <Field label="Religion" value={student.religion} />
            <Field label="Government ID" value={student.govtIdRef} />
          </Section>

          <Section title="Admission">
            <Field label="Admission number" value={student.admissionNumber} />
            <Field label="Enrollment number" value={student.enrollmentNumber} />
            <Field label="Admission date" value={student.admissionDate?.slice(0, 10)} />
            <Field
              label="Admission type"
              value={student.admissionType ? ADMISSION_TYPE_LABELS[student.admissionType] ?? student.admissionType : null}
            />
            <Field label="Previous school" value={student.previousSchool} />
            <Field label="Previous class" value={student.previousClass} />
          </Section>

          <Section title="Academic">
            <Field label="Academic year" value={student.academicYear.label} />
            <Field label="Class" value={student.class.name} />
            <Field label="Section" value={student.section?.name} />
            <Field label="Roll number" value={student.rollNumber} />
            <Field label="House" value={student.house} />
            <Field label="Stream" value={student.stream} />
            <Field label="Medium" value={student.medium} />
            <Field
              label="Promotion status"
              value={
                student.promotionStatus
                  ? PROMOTION_STATUS_LABELS[student.promotionStatus] ?? student.promotionStatus
                  : null
              }
            />
            <Field label="Status" value={student.status} />
          </Section>

          <Card>
            <CardHeader>
              <CardTitle>Parents &amp; guardians</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {student.guardians && student.guardians.length > 0 ? (
                student.guardians.map((g) => <GuardianBlock key={g.id} link={g} />)
              ) : (
                <p className="text-muted-foreground">No parent or guardian recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Section title="Current address">
            <Field label="Address" value={student.address} />
            <Field label="Address line 2" value={student.addressLine2} />
            <Field label="City" value={student.city} />
            <Field label="District" value={student.district} />
            <Field label="State" value={student.state} />
            <Field label="Country" value={student.country} />
            <Field label="PIN code" value={student.pinCode} />
          </Section>

          {!student.sameAsCurrent && (
            <Section title="Permanent address">
              <Field label="Address" value={student.permanentAddress} />
              <Field label="Address line 2" value={student.permanentLine2} />
              <Field label="City" value={student.permanentCity} />
              <Field label="District" value={student.permanentDistrict} />
              <Field label="State" value={student.permanentState} />
              <Field label="Country" value={student.permanentCountry} />
              <Field label="PIN code" value={student.permanentPinCode} />
            </Section>
          )}

          <Section title="Contact">
            <Field label="Primary mobile" value={student.primaryMobile} />
            <Field label="Secondary mobile" value={student.secondaryMobile} />
            <Field label="WhatsApp" value={student.whatsappNumber} />
            <Field label="Student email" value={student.studentEmail} />
            <Field label="Parent email" value={student.parentEmail} />
          </Section>

          <Section title="Emergency">
            <Field label="Contact name" value={student.emergencyName} />
            <Field label="Relationship" value={student.emergencyRelation} />
            <Field label="Phone" value={student.emergencyContact} />
            <Field label="Alternate phone" value={student.emergencyAltPhone} />
            <Field label="Address" value={student.emergencyAddress} />
          </Section>

          <Section title="Transport">
            <Field label="Bus number" value={student.busNumber} />
            <Field label="Route" value={student.route} />
            <Field label="Pickup point" value={student.pickupPoint} />
          </Section>

          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleDocuments}
              aria-expanded={showDocuments}
              aria-controls="student-documents"
            >
              <FileText className="size-4" />
              {showDocuments ? "Hide documents" : "Show all documents"}
            </Button>
          </div>

          {showDocuments && (
            <div id="student-documents">
              {documentsError ? (
                <ErrorState onRetry={loadDocuments} />
              ) : documents === null ? (
                <LoadingState />
              ) : documents.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Admission papers and academic records filed for this student will appear here."
                />
              ) : (
                <div className="flex flex-col gap-6">
                  <DocumentGroup title="Admission documents" documents={documents.filter((d) => d.category === "admission")} />
                  <DocumentGroup title="Academic documents" documents={documents.filter((d) => d.category === "academic")} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">{children}</CardContent>
    </Card>
  );
}

function GuardianBlock({ link }: { link: StudentGuardianRef }) {
  const { guardian } = link;
  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{guardian.fullName}</p>
        <Badge variant="neutral">{RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}</Badge>
        {link.isPrimary && <Badge variant="success">Primary contact</Badge>}
        {link.isEmergencyContact && <Badge variant="warning">Emergency</Badge>}
        {link.isAuthorizedPickup && <Badge variant="neutral">Authorized pickup</Badge>}
        {link.canReceiveFee && <Badge variant="neutral">Fee notices</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Field label="Mobile" value={guardian.mobile} />
        <Field label="Alternate mobile" value={guardian.alternateMobile} />
        <Field label="Email" value={guardian.email} />
        <Field label="Occupation" value={guardian.occupation} />
        <Field label="Employer" value={guardian.organization} />
        <Field label="Qualification" value={guardian.education} />
      </div>
    </div>
  );
}

function DocumentGroup({ title, documents }: { title: string; documents: StudentDocumentRecord[] }) {
  if (documents.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {doc.title || STUDENT_DOCUMENT_LABELS[doc.documentType] || doc.documentType}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {doc.uploadedFile?.originalName ?? "File"}
                {doc.version > 1 ? ` · v${doc.version}` : ""}
                {doc.issuedOn ? ` · issued ${doc.issuedOn.slice(0, 10)}` : ""}
              </p>
            </div>
            <Badge variant={doc.status === "verified" ? "success" : doc.status === "rejected" ? "danger" : "neutral"}>
              {doc.status}
            </Badge>
            {/* Files are never public — this route checks permission before streaming. */}
            <a
              href={`/api/files/${doc.uploadedFileId}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary-600 underline-offset-4 hover:underline"
            >
              View
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
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
