"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Wallet, Download, Pencil, Trash2 } from "lucide-react";
import { feeStructureService } from "@/services/feeStructureService";
import { academicYearService } from "@/services/academicYearService";
import type { FeeStructureListResponse, FeeStructureRecord } from "@/types/fees";
import type { AcademicYearRecord } from "@/types/academicYear";
import { FEE_STRUCTURE_STATUS_LABELS } from "@/lib/constants/fees";
import { useCan } from "@/hooks/use-can";
import { toCsv, downloadCsv } from "@/lib/csv";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

export function FeeStructureTable() {
  const can = useCan();
  const canCreate = can("feeStructures", "create");
  const canEdit = can("feeStructures", "edit");
  const canDelete = can("feeStructures", "delete");

  const [result, setResult] = useState<FeeStructureListResponse | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<FeeStructureRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => setAcademicYears(r.data)).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    feeStructureService
      .list({ q: search || undefined, academicYearId: academicYearId || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load fee structures."))
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
      await feeStructureService.remove(deleting.id);
      toast({ title: "Fee structure deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the fee structure.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Name", value: (s) => s.name },
      { header: "Academic Year", value: (s) => ("label" in s.academicYear ? s.academicYear.label : "") },
      { header: "Class", value: (s) => s.class?.name },
      { header: "Section", value: (s) => s.section?.name },
      { header: "Student Category", value: (s) => s.studentCategory?.name },
      { header: "Items", value: (s) => s.items.length },
      { header: "Total Amount", value: (s) => s.totalAmount },
      { header: "Assigned Students", value: (s) => s.counts?.assignedStudents ?? 0 },
      { header: "Status", value: (s) => s.status },
    ]);
    downloadCsv("fee-structures.csv", csv);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name..."
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
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(FEE_STRUCTURE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={handleExport} disabled={!result || result.data.length === 0}>
          <Download className="size-4" /> Export
        </Button>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/fees/structure/new">
              <Plus className="size-4" /> Add Fee Structure
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="No fee structures found"
          description="Try a different search or filter, or set up your first fee structure."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/fees/structure/new">
                  <Plus className="size-4" /> Add Fee Structure
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
                <TableHead>Name</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link href={`/fees/structure/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{"label" in row.academicYear ? row.academicYear.label : ""}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[row.class?.name, row.section?.name, row.studentCategory?.name].filter(Boolean).join(" · ") || "Everyone"}
                  </TableCell>
                  <TableCell>{row.items.length}</TableCell>
                  <TableCell>₹{row.totalAmount.toLocaleString("en-IN")}</TableCell>
                  <TableCell>{row.counts?.assignedStudents ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[row.status] ?? "neutral"}>
                      {(FEE_STRUCTURE_STATUS_LABELS as Record<string, string>)[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/fees/structure/${row.id}`}>View</Link>
                      </Button>
                      {canEdit && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/fees/structure/${row.id}/edit`}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      {canDelete && row.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                          onClick={() => setDeleting(row)}
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
              {result.total} fee structure{result.total === 1 ? "" : "s"}
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
        title={`Delete ${deleting?.name ?? "fee structure"}?`}
        description="This can't be undone. Only draft fee structures can be deleted — published ones are archived instead, to keep the record for history."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
