"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, UserCog } from "lucide-react";
import { staffService } from "@/services/staffService";
import type { StaffListResponse } from "@/types/staff";
import { STAFF_CATEGORIES, STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

const PAGE_SIZE = 20;

export function StaffTable({ fixedCategory }: { fixedCategory?: string }) {
  const [result, setResult] = useState<StaffListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(fixedCategory ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      staffService
        .list({ q: search || undefined, category: category || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load staff."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, category, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const addHref = fixedCategory === "teacher" ? "/employees/new?category=teacher" : "/employees/new";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name, employee ID..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        {!fixedCategory && (
          <Select
            value={category || "all"}
            onValueChange={(v) => {
              setPage(1);
              setCategory(v === "all" ? "" : v);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {STAFF_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {STAFF_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button asChild className="ml-auto">
          <Link href={addHref}>
            <Plus className="size-4" /> Add {fixedCategory === "teacher" ? "teacher" : "staff"}
          </Link>
        </Button>
      </div>

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={UserCog}
          title="No staff found"
          description="Try a different search or filter, or add a new record."
          action={
            <Button asChild size="sm">
              <Link href={addHref}>
                <Plus className="size-4" /> Add {fixedCategory === "teacher" ? "teacher" : "staff"}
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
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={staff.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")} size="sm" />
                      <span className="font-medium">{staff.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{staff.employeeId}</TableCell>
                  <TableCell>{staff.designation}</TableCell>
                  <TableCell>{staff.department?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={staff.employmentStatus === "active" ? "success" : "neutral"}>
                      {staff.employmentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/employees/${staff.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} record{result.total === 1 ? "" : "s"}
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
