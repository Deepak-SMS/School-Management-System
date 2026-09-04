"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCheck2, MoveRight, Search } from "lucide-react";
import {
  studentRegistrationService,
  type StudentRegistrationRecord,
} from "@/services/studentRegistrationService";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import type { StudentGuardianInput, StudentInput } from "@/lib/validation/student";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONE,
  APPLICATION_TRANSITION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/constants/admissions";
import { StudentForm } from "@/features/students/student-form";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton, LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export function ApplicationsReview() {
  const can = useCan();
  const [rows, setRows] = useState<StudentRegistrationRecord[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [reviewing, setReviewing] = useState<StudentRegistrationRecord | null>(null);

  const load = useCallback(() => {
    setError(false);
    studentRegistrationService
      .list({ status, q: search || undefined })
      .then((r) => {
        setRows(r.data);
        setPendingCount(r.pendingCount);
      })
      .catch(() => setError(true));
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function moveStatus(row: StudentRegistrationRecord, next: (typeof APPLICATION_TRANSITION_STATUSES)[number]) {
    try {
      await studentRegistrationService.setStatus(row.id, next);
      toast({ title: `Moved to ${APPLICATION_STATUS_LABELS[next]}` });
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the status.", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search applicant name or contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]} {s === "pending" && pendingCount > 0 && `(${pendingCount})`}
              </SelectItem>
            ))}
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState description="Couldn't load applications." onRetry={load} />}
      {!error && !rows && <TableSkeleton rows={5} columns={5} />}

      {!error && rows?.length === 0 && (
        <EmptyState
          icon={FileCheck2}
          title="No applications"
          description="Applications submitted through an admission form link will show up here for review."
        />
      )}

      {!error && rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.studentName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>{row.contactPhone ?? "—"}</span>
                      <span>{row.contactEmail ?? ""}</span>
                    </div>
                  </TableCell>
                  <TableCell>{row.form.title}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.submittedAt.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge variant={APPLICATION_STATUS_TONE[row.status as ApplicationStatus] ?? "neutral"}>
                      {APPLICATION_STATUS_LABELS[row.status as ApplicationStatus] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!TERMINAL_APPLICATION_STATUSES.includes(row.status as ApplicationStatus) ? (
                        <>
                          {can("studentRegistrations", "approve") && (
                            <Button variant="ghost" size="sm" onClick={() => setReviewing(row)}>
                              Review
                            </Button>
                          )}
                          {can("studentRegistrations", "edit") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoveRight className="size-4" /> Move to
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {APPLICATION_TRANSITION_STATUSES.filter((s) => s !== row.status).map((s) => (
                                  <DropdownMenuItem key={s} onSelect={() => moveStatus(row, s)}>
                                    {APPLICATION_STATUS_LABELS[s]}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      ) : row.student ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/students/${row.student.id}`}>View student</a>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          submission={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={() => {
            setReviewing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Turns what a parent submitted into a starting point for the student form —
 * the same fields, mapped by name, plus a soft match of the free-text
 * "applying for class" against the school's actual classes. Anything the
 * public form doesn't ask (category, house, admission type...) is simply left
 * for the reviewer to fill in, the same as adding a student from scratch.
 */
function mapPayloadToStudentInput(
  payload: Record<string, unknown>,
  structure: SchoolStructure | null,
): Partial<StudentInput> {
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
  const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

  const appliedForClass = str(payload.appliedForClass);
  const matchedClassId = appliedForClass
    ? structure?.classes.find((c) => c.name.trim().toLowerCase() === appliedForClass.trim().toLowerCase())?.id
    : undefined;
  const currentYearId = structure?.academicYears.find((y) => y.isCurrent)?.id;

  const guardiansRaw = Array.isArray(payload.guardians) ? (payload.guardians as Record<string, unknown>[]) : [];
  const guardians: StudentGuardianInput[] = guardiansRaw
    .filter((g) => str(g.fullName))
    .map((g) => ({
      relationship: (str(g.relationship) ?? "guardian") as StudentGuardianInput["relationship"],
      fullName: str(g.fullName) ?? "",
      mobile: str(g.mobile),
      alternateMobile: str(g.alternateMobile),
      email: str(g.email),
      occupation: str(g.occupation),
      organization: str(g.organization),
      isPrimary: bool(g.isPrimary),
      isEmergencyContact: bool(g.isEmergencyContact),
      isAuthorizedPickup: bool(g.isAuthorizedPickup),
    }));

  const mapped: Partial<StudentInput> = {
    firstName: str(payload.firstName),
    middleName: str(payload.middleName),
    lastName: str(payload.lastName),
    dateOfBirth: str(payload.dateOfBirth),
    gender: str(payload.gender) as StudentInput["gender"],
    bloodGroup: str(payload.bloodGroup) as StudentInput["bloodGroup"],
    nationality: str(payload.nationality),
    motherTongue: str(payload.motherTongue),
    previousSchool: str(payload.previousSchool),
    admissionDate: new Date().toISOString().slice(0, 10),
    academicYearId: currentYearId,
    classId: matchedClassId,
    address: str(payload.address),
    addressLine2: str(payload.addressLine2),
    city: str(payload.city),
    state: str(payload.state),
    country: str(payload.country),
    pinCode: str(payload.pinCode),
    sameAsCurrent: bool(payload.sameAsCurrent),
    permanentAddress: str(payload.permanentAddress),
    permanentCity: str(payload.permanentCity),
    permanentState: str(payload.permanentState),
    permanentCountry: str(payload.permanentCountry),
    permanentPinCode: str(payload.permanentPinCode),
    primaryMobile: str(payload.primaryMobile),
    secondaryMobile: str(payload.secondaryMobile),
    studentEmail: str(payload.studentEmail),
    parentEmail: str(payload.parentEmail),
    whatsappNumber: str(payload.whatsappNumber),
    emergencyName: str(payload.emergencyName),
    emergencyRelation: str(payload.emergencyRelation),
    emergencyContact: str(payload.emergencyContact),
    emergencyAltPhone: str(payload.emergencyAltPhone),
    emergencyAddress: str(payload.emergencyAddress),
    guardians: guardians.length ? guardians : undefined,
  };

  // Drop undefined keys so they don't shadow StudentForm's own defaults
  // (country, sameAsCurrent, admission type, starter guardian blocks).
  return Object.fromEntries(Object.entries(mapped).filter(([, v]) => v !== undefined)) as Partial<StudentInput>;
}

function ReviewModal({
  submission,
  onClose,
  onReviewed,
}: {
  submission: StudentRegistrationRecord;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => undefined);
  }, []);

  const payload = (submission.payload ?? {}) as Record<string, unknown>;

  async function reject() {
    if (!reviewNote.trim()) {
      setError("A reason is required to reject a submission.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await studentRegistrationService.review(submission.id, { action: "reject", reviewNote: reviewNote.trim() });
      toast({ title: "Application rejected" });
      onReviewed();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't submit the review.");
    } finally {
      setBusy(false);
    }
  }

  // Left to throw on failure — StudentForm's own submit handler catches it
  // and shows the error inline, exactly like the "Add student" page.
  async function approve(values: StudentInput) {
    const result = await studentRegistrationService.review(submission.id, {
      ...values,
      action: "approve",
      reviewNote: reviewNote.trim() || undefined,
    });
    toast({
      title: "Application approved",
      description: `Student record created — admission no. ${result.admissionNumber}`,
      variant: "success",
    });
    onReviewed();
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Review application — ${submission.studentName}`}
        description={`Submitted ${submission.submittedAt.slice(0, 10)} via "${submission.form.title}"`}
        size="xl"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant={decision === "approve" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setDecision("approve")}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant={decision === "reject" ? "destructive" : "secondary"}
              size="sm"
              onClick={() => setDecision("reject")}
            >
              Reject
            </Button>
          </div>

          {decision === "approve" ? (
            <>
              <Alert variant="info">
                This is the same form used to add a student directly, pre-filled from the application. Review it,
                fill in the admission number, class and anything else missing, then save to create the student.
              </Alert>
              <FormField label="Internal note" description="Optional — visible to staff only">
                {(f) => <Textarea {...f} rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />}
              </FormField>
              {structure ? (
                <StudentForm
                  defaultValues={mapPayloadToStudentInput(payload, structure)}
                  submitLabel="Approve & create student"
                  onSubmit={approve}
                />
              ) : (
                <LoadingState />
              )}
            </>
          ) : (
            <>
              <FormField label="Reason for rejection" required>
                {(f) => <Textarea {...f} rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />}
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={reject} isLoading={busy}>
                  Reject application
                </Button>
              </div>
            </>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
