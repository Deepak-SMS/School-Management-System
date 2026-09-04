"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Building2, Eye } from "lucide-react";
import { platformService } from "@/services/platformService";
import type { SchoolListResponse } from "@/types/platform";
import { SCHOOL_STATUSES, SCHOOL_STATUS_LABELS, SCHOOL_PLAN_LABELS } from "@/lib/constants/platform";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

const PAGE_SIZE = 20;

const STATUS_BADGE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trial: "warning",
  suspended: "danger",
  expired: "danger",
  cancelled: "neutral",
};

/**
 * List view only — Edit/Reset password/Delete all live inside a school's own
 * detail page (View), not here. Keeps this table scannable and keeps every
 * consequential action behind one confirmation flow instead of two places.
 */
export function SchoolsTable() {
  const [result, setResult] = useState<SchoolListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  function load() {
    setLoading(true);
    setError(null);
    platformService
      .listSchools({ q: search || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load schools."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name, city..."
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
            {SCHOOL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SCHOOL_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild className="ml-auto">
          <Link href="/super-admin/schools/new">
            <Plus className="size-4" /> Create School
          </Link>
        </Button>
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No schools found"
          description="Try a different search or filter, or onboard your first school."
          action={
            <Button asChild size="sm">
              <Link href="/super-admin/schools/new">
                <Plus className="size-4" /> Create School
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
                <TableHead>School</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">
                    <Link href={`/super-admin/schools/${school.id}`} className="hover:underline">
                      {school.name}
                    </Link>
                    {school.city && <p className="text-xs font-normal text-muted-foreground">{school.city}</p>}
                  </TableCell>
                  <TableCell>
                    {school.admin ? (
                      <div>
                        <p>{school.admin.name}</p>
                        <p className="text-xs text-muted-foreground">{school.admin.email}</p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{school.studentCount}</TableCell>
                  <TableCell>{SCHOOL_PLAN_LABELS[school.plan as keyof typeof SCHOOL_PLAN_LABELS] ?? school.plan}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_TONE[school.status] ?? "neutral"}>
                      {SCHOOL_STATUS_LABELS[school.status as keyof typeof SCHOOL_STATUS_LABELS] ?? school.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(school.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/super-admin/schools/${school.id}`}>
                        <Eye className="size-4" /> View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} school{result.total === 1 ? "" : "s"}
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
