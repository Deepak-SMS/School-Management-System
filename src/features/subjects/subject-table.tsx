"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, BookOpen, Download, Pencil, Trash2, UserPlus } from "lucide-react";
import { subjectService } from "@/services/subjectService";
import type { SubjectListResponse, SubjectRecord } from "@/types/subject";
import type { ApiError } from "@/services/studentService";
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from "@/lib/constants/school";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalContent } from "@/components/ui/modal";
import { SubjectForm } from "@/features/subjects/subject-form";
import { AssignTeacherModal } from "@/features/subjects/assign-teacher-modal";
import type { SubjectInput } from "@/lib/validation/subject";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

export function SubjectTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "subjects", "create");
  const canExport = hasPermission(user.role, "subjects", "export");
  const canEdit = hasPermission(user.role, "subjects", "edit");
  const canDelete = hasPermission(user.role, "subjects", "delete");

  const [result, setResult] = useState<SubjectListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SubjectRecord | null>(null);
  const [deleting, setDeleting] = useState<SubjectRecord | null>(null);
  const [assigning, setAssigning] = useState<SubjectRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      subjectService
        .list({ q: search || undefined, subjectType: subjectType || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load subjects."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, subjectType, page, reloadKey]);

  /**
   * A subject still in use — assigned to a class, scheduled in a timetable,
   * referenced by attendance records, or linked to library books — can't be
   * deleted; the API refuses it, since removing it would orphan those rows.
   * Deactivating is the honest alternative, so that's what the dialog offers
   * in that case. `deletable` defaults true only when the list response
   * hasn't told us otherwise, so a stale/missing field never blocks unnecessarily.
   */
  const deletingIsAssigned = deleting ? deleting.deletable === false : false;

  async function handleDeleteOrDeactivate() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      if (deletingIsAssigned) {
        await subjectService.update(deleting.id, { status: "inactive" });
        toast({ title: `${deleting.name} deactivated`, variant: "success" });
      } else {
        await subjectService.remove(deleting.id);
        toast({ title: `${deleting.name} deleted`, variant: "success" });
      }
      setDeleting(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the subject", variant: "danger" });
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Subject Name", value: (s) => s.name },
      { header: "Subject Code", value: (s) => s.code },
      { header: "Type", value: (s) => SUBJECT_TYPE_LABELS[s.subjectType as keyof typeof SUBJECT_TYPE_LABELS] ?? s.subjectType },
      { header: "Classes", value: (s) => s.counts?.classes ?? 0 },
      { header: "Teachers", value: (s) => s.counts?.teachers ?? 0 },
      { header: "Max Marks", value: (s) => s.maxMarks },
      { header: "Passing Marks", value: (s) => s.passingMarks },
      { header: "Credits", value: (s) => s.credits },
      { header: "Status", value: (s) => s.status },
    ]);
    downloadCsv("subjects.csv", csv);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name, code..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={subjectType || "all"}
          onValueChange={(v) => {
            setPage(1);
            setSubjectType(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SUBJECT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {SUBJECT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canExport && (
          <Button variant="secondary" onClick={handleExport} disabled={!result || result.data.length === 0}>
            <Download className="size-4" /> Export
          </Button>
        )}
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/school/subjects/new">
              <Plus className="size-4" /> Add Subject
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No subjects found"
          description="Try a different search or filter, or add your first subject."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/school/subjects/new">
                  <Plus className="size-4" /> Add Subject
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Teachers</TableHead>
                <TableHead>Max / Passing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{SUBJECT_TYPE_LABELS[subject.subjectType as keyof typeof SUBJECT_TYPE_LABELS] ?? subject.subjectType}</TableCell>
                  <TableCell>{subject.counts?.classes ?? 0}</TableCell>
                  <TableCell>{subject.counts?.teachers ?? 0}</TableCell>
                  <TableCell>
                    {subject.maxMarks ?? "—"} / {subject.passingMarks ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subject.status === "active" ? "success" : "neutral"}>{subject.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/subjects/${subject.id}`}>View</Link>
                      </Button>
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setAssigning(subject)}>
                          <UserPlus className="size-4" /> Add teacher
                        </Button>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(subject)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(subject)}>
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} subject{result.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <Modal open onOpenChange={(v) => !v && setEditing(null)}>
          <ModalContent title={`Edit ${editing.name}`} size="lg">
            <SubjectForm
              submitLabel="Save changes"
              defaultValues={{
                name: editing.name,
                code: editing.code,
                subjectType: editing.subjectType as SubjectInput["subjectType"],
                natureType: editing.natureType as SubjectInput["natureType"],
                description: editing.description ?? undefined,
                maxMarks: editing.maxMarks ?? undefined,
                passingMarks: editing.passingMarks ?? undefined,
                credits: editing.credits ?? undefined,
                gradingSystem: (editing.gradingSystem ?? undefined) as SubjectInput["gradingSystem"],
                status: editing.status as SubjectInput["status"],
              }}
              onSubmit={async (input) => {
                await subjectService.update(editing.id, input);
                toast({ title: "Subject updated", variant: "success" });
                setEditing(null);
                setReloadKey((k) => k + 1);
              }}
            />
          </ModalContent>
        </Modal>
      )}

      {assigning && (
        <AssignTeacherModal
          subject={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={() => {
            setAssigning(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={
          deletingIsAssigned ? `Deactivate ${deleting?.name ?? "subject"}?` : `Delete ${deleting?.name ?? "subject"}?`
        }
        description={
          deletingIsAssigned
            ? `This subject is still in use — assigned to a class, scheduled in a timetable, or referenced by attendance or library records — so it can't be deleted without orphaning that data. It will be deactivated instead: hidden from pickers, but kept on record.`
            : "This subject isn't in use anywhere and will be deleted permanently."
        }
        confirmLabel={deletingIsAssigned ? "Deactivate" : "Delete subject"}
        variant="destructive"
        isLoading={deleteBusy}
        onConfirm={handleDeleteOrDeactivate}
      />
    </div>
  );
}
