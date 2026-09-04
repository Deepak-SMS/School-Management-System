"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, GraduationCap, Upload, FileDown, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StudentAccessDialog, type StudentAccountRow } from "@/features/portal-access/student-access-dialog";
import { StudentPortalAccessImportModal } from "@/features/portal-access/student-portal-access-import-modal";
import { schoolStructureService } from "@/services/schoolStructureService";
import { useCan } from "@/hooks/use-can";
import { toast } from "@/hooks/use-toast";
import type { SchoolStructure } from "@/types/student";
import type { ApiError } from "@/services/studentService";

interface StudentAccountsResponse {
  data: StudentAccountRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export function StudentAccountsTable() {
  const can = useCan();
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [result, setResult] = useState<StudentAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState<StudentAccountRow | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const canBulkGrant = can("students", "import") && can("schoolProfile", "edit");
  const canExportData = can("database", "export");

  async function downloadStudentData() {
    try {
      // Same class/section/search filters currently applied to the table
      // below, so the file matches what's on screen — not the whole school.
      const query = new URLSearchParams();
      if (search) query.set("q", search);
      if (classId) query.set("classId", classId);
      if (sectionId) query.set("sectionId", sectionId);

      const response = await fetch(`/api/students/accounts/export?${query.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't download student data.");
      }
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `students-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "danger" });
    }
  }

  async function downloadTemplate() {
    try {
      const response = await fetch("/api/students/import-portal-access/template");
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't download the template.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student-portal-access-template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "danger" });
    }
  }

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => {});
  }, []);

  const sections = useMemo(
    () => structure?.classes.find((c) => c.id === classId)?.sections ?? [],
    [structure, classId],
  );

  function load() {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) query.set("q", search);
    if (classId) query.set("classId", classId);
    if (sectionId) query.set("sectionId", sectionId);
    fetch(`/api/students/accounts?${query.toString()}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body as ApiError;
        return body as StudentAccountsResponse;
      })
      .then(setResult)
      .catch(() => setError("Couldn't load students."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classId, sectionId, page]);

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
            setSectionId("");
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
          value={sectionId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setSectionId(v === "all" ? "" : v);
          }}
          disabled={!classId}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {canExportData && (
            <Button variant="secondary" onClick={downloadStudentData}>
              <Download className="size-4" /> Download student data
            </Button>
          )}
          {canBulkGrant && (
            <>
              <Button variant="secondary" onClick={downloadTemplate}>
                <FileDown className="size-4" /> Download template
              </Button>
              <Button variant="secondary" onClick={() => setBulkImportOpen(true)}>
                <Upload className="size-4" /> Bulk grant access
              </Button>
            </>
          )}
        </div>
      </div>

      {loading && <TableSkeleton rows={8} columns={5} />}

      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState icon={GraduationCap} title="No students found" description="Try a different search." />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Login email</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell>
                    {student.class?.name}
                    {student.section ? ` ${student.section.name}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.user?.email ?? "—"}</TableCell>
                  <TableCell>
                    {!student.user && <Badge variant="neutral">No login</Badge>}
                    {student.user?.isActive && !student.user.mustChangePassword && (
                      <Badge variant="success">Active</Badge>
                    )}
                    {student.user?.isActive && student.user.mustChangePassword && (
                      <Badge variant="warning">Password reset required</Badge>
                    )}
                    {student.user && !student.user.isActive && <Badge variant="danger">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setManaging(student)}>
                      Manage access
                    </Button>
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

      {managing && (
        <StudentAccessDialog
          student={managing}
          onClose={() => setManaging(null)}
          onSaved={() => {
            setManaging(null);
            load();
          }}
        />
      )}

      <StudentPortalAccessImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onImported={() => {
          setBulkImportOpen(false);
          load();
        }}
      />
    </div>
  );
}
