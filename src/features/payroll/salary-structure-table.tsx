"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Layers, Pencil, Trash2 } from "lucide-react";
import { salaryStructureService } from "@/services/payrollService";
import type { SalaryStructureRecord } from "@/types/payroll";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export function SalaryStructureTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "payroll", "create");
  const canEdit = hasPermission(user.role, "payroll", "edit");
  const canDelete = hasPermission(user.role, "payroll", "delete");

  const [rows, setRows] = useState<SalaryStructureRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [deleting, setDeleting] = useState<SalaryStructureRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function load() {
    setError(false);
    salaryStructureService
      .list()
      .then((r) => setRows(r.data))
      .catch(() => setError(true));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const result = await salaryStructureService.remove(deleting.id);
      toast({
        title: result.deactivated ? "Structure deactivated" : "Structure deleted",
        description: result.deactivated ? `${result.staffEverAssigned} staff member(s) have used it, so it was kept for history.` : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the structure.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  if (error) return <ErrorState description="Couldn't load salary structures." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={5} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} structure{rows.length === 1 ? "" : "s"}
        </p>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/hr/payroll/structures/new">
              <Plus className="size-4" /> Add structure
            </Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No salary structures yet"
          description="A structure — 'Teacher Grade I' — bundles the components a group of staff are paid with. Add salary components first, then build a structure from them."
          action={canCreate ? <Button asChild size="sm"><Link href="/hr/payroll/structures/new"><Plus className="size-4" /> Add structure</Link></Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Assigned staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.name}
                  {row.description && <div className="text-xs font-normal text-muted-foreground">{row.description}</div>}
                </TableCell>
                <TableCell>{row.items.length}</TableCell>
                <TableCell>{row.assignedStaffCount}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status === "active" ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/hr/payroll/structures/${row.id}`}>View</Link>
                    </Button>
                    {canEdit && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/hr/payroll/structures/${row.id}/edit`}>
                          <Pencil className="size-4" /> Edit
                        </Link>
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-50 hover:text-danger-600" onClick={() => setDeleting(row)}>
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove ${deleting?.name ?? "this structure"}?`}
        description="This can't be undone."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
