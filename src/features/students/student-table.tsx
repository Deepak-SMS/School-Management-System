"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Users, Pencil, Trash2 } from "lucide-react";
import { studentService } from "@/services/studentService";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import type { StudentListResponse, StudentRecord } from "@/types/student";
import { STUDENT_STATUSES } from "@/lib/constants/people";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { StudentToolbar } from "@/features/students/student-toolbar";
import type { ApiError } from "@/services/studentService";

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  active: "success",
  inactive: "neutral",
  graduated: "neutral",
  transferred: "warning",
  suspended: "danger",
};

const PAGE_SIZE = 20;

export function StudentTable() {
  const user = useCurrentUser();
  const canEdit = hasPermission(user.role, "students", "edit");
  const canDelete = hasPermission(user.role, "students", "delete");

  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [result, setResult] = useState<StudentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<StudentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    studentService
      .list({ q: search || undefined, classId: classId || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load students."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classId, status, page]);

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await studentService.remove(deleting.id);
      toast({ title: "Student deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the student.", variant: "danger" });
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
            placeholder="Search by name, admission no..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={classId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setClassId(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {structure?.classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
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
            {STUDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Add / Import / Template / Parent form — see StudentToolbar. */}
        <div className="ml-auto">
          <StudentToolbar onImported={() => setPage(1)} />
        </div>
      </div>

      {loading && <TableSkeleton rows={8} columns={9} />}

      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Try a different search or filter, or add your first student."
          action={
            <Button asChild size="sm">
              <Link href="/students/new">
                <Plus className="size-4" /> Add student
              </Link>
            </Button>
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Admission No.</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Roll No.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Class Teacher</TableHead>
                <TableHead>Parent Mobile</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={`${student.firstName[0]}${student.lastName[0]}`} size="sm" />
                      <span className="font-medium">
                        {student.firstName} {student.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.admissionNumber}</TableCell>
                  <TableCell>{student.class.name}</TableCell>
                  <TableCell>{student.section?.name ?? "—"}</TableCell>
                  <TableCell>{student.rollNumber ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[student.status] ?? "neutral"}>{student.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.classTeacher?.fullName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{student.parentMobile ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/students/${student.id}`}>View</Link>
                      </Button>
                      {canEdit && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/students/${student.id}?edit=1`}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                          onClick={() => setDeleting(student)}
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
              {result.total} student{result.total === 1 ? "" : "s"}
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
        title={`Delete ${deleting?.firstName ?? "this student"}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
