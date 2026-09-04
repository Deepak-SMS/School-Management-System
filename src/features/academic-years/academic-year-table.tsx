"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, CalendarRange, Download, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { academicYearService } from "@/services/academicYearService";
import type { AcademicYearListResponse, AcademicYearRecord } from "@/types/academicYear";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ApiError } from "@/services/studentService";

const PAGE_SIZE = 20;

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger" | "info"> = {
  active: "success",
  draft: "neutral",
  upcoming: "info",
  archived: "neutral",
};

export function AcademicYearTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "academicYears", "create");
  const canExport = hasPermission(user.role, "academicYears", "export");
  const canActivate = hasPermission(user.role, "academicYears", "activate");
  const canEdit = hasPermission(user.role, "academicYears", "edit");
  const canDelete = hasPermission(user.role, "academicYears", "delete");

  const [result, setResult] = useState<AcademicYearListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AcademicYearRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    academicYearService
      .list({ q: search || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load academic years."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  async function handleSetActive(id: string) {
    setActivatingId(id);
    try {
      await academicYearService.setActive(id);
      toast({ title: "Academic year activated", variant: "success" });
      load();
    } catch {
      toast({ title: "Couldn't activate academic year", variant: "danger" });
    } finally {
      setActivatingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await academicYearService.remove(deleting.id);
      toast({ title: "Academic year deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the academic year.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Academic Year", value: (y) => y.label },
      { header: "Start Date", value: (y) => y.startDate.slice(0, 10) },
      { header: "End Date", value: (y) => y.endDate.slice(0, 10) },
      { header: "Status", value: (y) => y.status },
      { header: "Students", value: (y) => y.counts?.students ?? 0 },
      { header: "Classes", value: (y) => y.counts?.classes ?? 0 },
      { header: "Sections", value: (y) => y.counts?.sections ?? 0 },
    ]);
    downloadCsv("academic-years.csv", csv);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search academic years..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
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
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {canExport && (
          <Button variant="secondary" onClick={handleExport} disabled={!result || result.data.length === 0}>
            <Download className="size-4" /> Export
          </Button>
        )}
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/school/academic-years/new">
              <Plus className="size-4" /> Add Academic Year
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={5} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={CalendarRange}
          title="No academic years found"
          description="Add your first academic year to start structuring classes and sections."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/school/academic-years/new">
                  <Plus className="size-4" /> Add Academic Year
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
                <TableHead>Academic Year</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((year) => (
                <TableRow key={year.id}>
                  <TableCell className="font-medium">{year.label}</TableCell>
                  <TableCell className="text-muted-foreground">{year.startDate.slice(0, 10)}</TableCell>
                  <TableCell className="text-muted-foreground">{year.endDate.slice(0, 10)}</TableCell>
                  <TableCell>{year.counts?.students ?? 0}</TableCell>
                  <TableCell>{year.counts?.classes ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[year.status] ?? "neutral"}>{year.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canActivate && year.status !== "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          isLoading={activatingId === year.id}
                          onClick={() => handleSetActive(year.id)}
                        >
                          <CheckCircle2 className="size-4" /> Set active
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/academic-years/${year.id}`}>View</Link>
                      </Button>
                      {canEdit && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/school/academic-years/${year.id}?tab=settings`}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                          onClick={() => setDeleting(year)}
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
              {result.total} academic year{result.total === 1 ? "" : "s"}
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
        title={`Delete ${deleting?.label ?? "this academic year"}?`}
        description="This can't be undone. Academic years with classes or students assigned to them can't be deleted — archive them instead."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
