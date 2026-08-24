"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Building, Download } from "lucide-react";
import { departmentService } from "@/services/departmentService";
import type { DepartmentListResponse } from "@/types/department";
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

const PAGE_SIZE = 20;

export function DepartmentTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "departments", "create");
  const canExport = hasPermission(user.role, "departments", "export");

  const [result, setResult] = useState<DepartmentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentType, setDepartmentType] = useState("");
  const [page, setPage] = useState(1);

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
  }, [search, departmentType, page]);

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
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/school/departments/${dept.id}`}>View</Link>
                    </Button>
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
    </div>
  );
}
