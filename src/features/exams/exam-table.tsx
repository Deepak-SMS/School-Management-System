"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, ClipboardList, Eye, Pencil, Trash2, Info } from "lucide-react";
import { examService } from "@/services/examService";
import { academicYearService } from "@/services/academicYearService";
import type { ExamRecord } from "@/types/exam";
import type { AcademicYearRecord } from "@/types/academicYear";
import { EXAM_STATUSES, EXAM_STATUS_LABELS, EXAM_STATUS_DESCRIPTIONS } from "@/lib/constants/exam";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Modal, ModalContent } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "primary"> = {
  draft: "neutral",
  scheduled: "primary",
  ongoing: "warning",
  completed: "primary",
  results_pending: "warning",
  published: "success",
  archived: "neutral",
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return startDate.getTime() === endDate.getTime() ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export function ExamTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "exams", "create");
  const canEdit = hasPermission(user.role, "exams", "edit");
  const canDelete = hasPermission(user.role, "exams", "delete");

  const [result, setResult] = useState<{ data: ExamRecord[]; total: number } | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<ExamRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => setAcademicYears(r.data)).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    examService
      .list({ q: search || undefined, academicYearId: academicYearId || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load exams."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, academicYearId, status, page]);

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await examService.remove(deleting.id);
      toast({ title: "Exam deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the exam.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

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
          value={academicYearId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setAcademicYearId(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {academicYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(EXAM_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setShowStatusInfo(true)}>
          <Info className="size-4" /> Know more
        </Button>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/exams/new">
              <Plus className="size-4" /> Create Exam
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No exams found"
          description="Try a different search or filter, or create your first exam."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/exams/new">
                  <Plus className="size-4" /> Create Exam
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
                <TableHead>Exam</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">
                    {exam.name}
                    <div className="text-xs font-normal text-muted-foreground">{exam.code}{exam.term ? ` · ${exam.term}` : ""}</div>
                  </TableCell>
                  <TableCell>{exam.examType.name}</TableCell>
                  <TableCell>{exam.academicYear.label}</TableCell>
                  <TableCell>{formatDateRange(exam.startDate, exam.endDate)}</TableCell>
                  <TableCell>
                    {exam.classes.length} class{exam.classes.length === 1 ? "" : "es"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[exam.status] ?? "neutral"}>{EXAM_STATUS_LABELS[exam.status as keyof typeof EXAM_STATUS_LABELS] ?? exam.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/exams/${exam.id}`}>
                          <Eye className="size-4" /> View
                        </Link>
                      </Button>
                      {canEdit && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/exams/${exam.id}/edit`}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                          onClick={() => setDeleting(exam)}
                        >
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
              {result.total} exam{result.total === 1 ? "" : "s"}
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

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "exam"}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />

      <Modal open={showStatusInfo} onOpenChange={setShowStatusInfo}>
        <ModalContent title="Exam statuses" description="What each status means, and where an exam is in its lifecycle." size="lg">
          <ul className="flex flex-col divide-y divide-border">
            {EXAM_STATUSES.map((value) => (
              <li key={value} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <Badge variant={STATUS_VARIANT[value] ?? "neutral"} className="self-start">
                  {EXAM_STATUS_LABELS[value]}
                </Badge>
                <p className="text-sm text-muted-foreground">{EXAM_STATUS_DESCRIPTIONS[value]}</p>
              </li>
            ))}
          </ul>
        </ModalContent>
      </Modal>
    </div>
  );
}
