"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Building, Download, Pencil, Trash2 } from "lucide-react";
import { departmentService } from "@/services/departmentService";
import type { DepartmentListResponse, DepartmentRecord } from "@/types/department";
import type { ApiError } from "@/services/studentService";
import { DEPARTMENT_TYPES, DEPARTMENT_TYPE_LABELS } from "@/lib/constants/school";
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
import { DepartmentForm } from "@/features/departments/department-form";
import type { DepartmentInput } from "@/lib/validation/department";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

export function DepartmentTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "departments", "create");
  const canExport = hasPermission(user.role, "departments", "export");
  const canEdit = hasPermission(user.role, "departments", "edit");
  const canDelete = hasPermission(user.role, "departments", "delete");

  const [result, setResult] = useState<DepartmentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentType, setDepartmentType] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<DepartmentRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      departmentService
        .list({ q: search || undefined, departmentType: departmentType || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load departments."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, departmentType, page, reloadKey]);

  /**
   * A department with staff can't be deleted — the API refuses it, because
   * removing it would orphan those employees' history. In that case the honest
   * action is to deactivate, so the dialog offers exactly that rather than
   * promising a delete that would fail.
   */
  const deletingHasStaff = (deleting?.counts?.employees ?? 0) > 0;

  async function handleDeleteOrDeactivate() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      if (deletingHasStaff) {
        await departmentService.update(deleting.id, { status: "inactive" });
        toast({
          title: `${deleting.name} deactivated`,
          description: "It stays on record for the staff assigned to it.",
          variant: "success",
        });
      } else {
        await departmentService.remove(deleting.id);
        toast({ title: `${deleting.name} deleted`, variant: "success" });
      }
      setDeleting(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the department", variant: "danger" });
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Department Name", value: (d) => d.name },
      { header: "Department Code", value: (d) => d.code },
      { header: "Type", value: (d) => DEPARTMENT_TYPE_LABELS[d.departmentType as keyof typeof DEPARTMENT_TYPE_LABELS] ?? d.departmentType },
      { header: "Head", value: (d) => d.head?.fullName },
      { header: "Employees", value: (d) => d.counts?.employees ?? 0 },
      { header: "Teachers", value: (d) => d.counts?.teachers ?? 0 },
      { header: "Status", value: (d) => d.status },
    ]);
    downloadCsv("departments.csv", csv);
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
          value={departmentType || "all"}
          onValueChange={(v) => {
            setPage(1);
            setDepartmentType(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DEPARTMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {DEPARTMENT_TYPE_LABELS[t]}
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
            <Link href="/school/departments/new">
              <Plus className="size-4" /> Add Department
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Building}
          title="No departments found"
          description="Try a different search or filter, or add your first department."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/school/departments/new">
                  <Plus className="size-4" /> Add Department
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
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Head</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell>{DEPARTMENT_TYPE_LABELS[dept.departmentType as keyof typeof DEPARTMENT_TYPE_LABELS] ?? dept.departmentType}</TableCell>
                  <TableCell>{dept.head?.fullName ?? "—"}</TableCell>
                  <TableCell>{dept.counts?.employees ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={dept.status === "active" ? "success" : "neutral"}>{dept.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/departments/${dept.id}`}>View</Link>
                      </Button>
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(dept)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(dept)}>
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
              {result.total} department{result.total === 1 ? "" : "s"}
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
        title={
          deletingHasStaff
            ? `Deactivate ${deleting?.name ?? "department"}?`
            : `Delete ${deleting?.name ?? "department"}?`
        }
        description={
          deletingHasStaff
            ? `${deleting?.counts?.employees} employee(s) work here, so this department can't be deleted — that would orphan their records. It will be deactivated instead: hidden from pickers, but kept on record. Move the staff elsewhere first if you want to delete it.`
            : "This department has no staff and will be deleted permanently."
        }
        confirmLabel={deletingHasStaff ? "Deactivate" : "Delete department"}
        variant="destructive"
        isLoading={deleteBusy}
        onConfirm={handleDeleteOrDeactivate}
      />

      {editing && (
        <Modal open onOpenChange={(v) => !v && setEditing(null)}>
          <ModalContent title={`Edit ${editing.name}`} size="lg">
            <DepartmentForm
              submitLabel="Save changes"
              defaultValues={{
                name: editing.name,
                code: editing.code,
                departmentType: editing.departmentType as DepartmentInput["departmentType"],
                headStaffId: editing.head?.id ?? undefined,
                description: editing.description ?? undefined,
                campusId: editing.campus?.id ?? undefined,
                email: editing.email ?? undefined,
                phone: editing.phone ?? undefined,
                status: editing.status as DepartmentInput["status"],
              }}
              onSubmit={async (input) => {
                await departmentService.update(editing.id, input);
                toast({ title: "Department updated", variant: "success" });
                setEditing(null);
                setReloadKey((k) => k + 1);
              }}
            />
          </ModalContent>
        </Modal>
      )}
    </div>
  );
}
