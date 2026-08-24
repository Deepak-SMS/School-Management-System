"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Building2, Download } from "lucide-react";
import { campusService } from "@/services/campusService";
import type { CampusListResponse } from "@/types/campus";
import { CAMPUS_TYPE_LABELS } from "@/lib/constants/school";
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

export function CampusTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "campuses", "create");
  const canExport = hasPermission(user.role, "campuses", "export");

  const [result, setResult] = useState<CampusListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      campusService
        .list({ q: search || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load campuses."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, status, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Campus Name", value: (c) => c.name },
      { header: "Campus Code", value: (c) => c.code },
      { header: "Type", value: (c) => CAMPUS_TYPE_LABELS[c.campusType as keyof typeof CAMPUS_TYPE_LABELS] ?? c.campusType },
      { header: "Head", value: (c) => c.head?.fullName },
      { header: "City", value: (c) => c.city },
      { header: "Phone", value: (c) => c.phone },
      { header: "Students", value: (c) => c.counts?.students ?? 0 },
      { header: "Status", value: (c) => c.status },
    ]);
    downloadCsv("campuses.csv", csv);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name, code, city..."
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {canExport && (
          <Button variant="secondary" onClick={handleExport} disabled={!result || result.data.length === 0}>
            <Download className="size-4" /> Export
          </Button>
        )}
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/school/campuses/new">
              <Plus className="size-4" /> Add Campus
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No campuses found"
          description="Try a different search or filter, or add your first campus."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/school/campuses/new">
                  <Plus className="size-4" /> Add Campus
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
                <TableHead>Campus Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Head</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((campus) => (
                <TableRow key={campus.id}>
                  <TableCell className="font-medium">{campus.name}</TableCell>
                  <TableCell className="text-muted-foreground">{campus.code}</TableCell>
                  <TableCell>{campus.head?.fullName ?? "—"}</TableCell>
                  <TableCell>{campus.city ?? "—"}</TableCell>
                  <TableCell>{campus.counts?.students ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={campus.status === "active" ? "success" : "neutral"}>{campus.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/school/campuses/${campus.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} campus{result.total === 1 ? "" : "es"}
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
