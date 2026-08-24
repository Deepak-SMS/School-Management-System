"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, School, Download } from "lucide-react";
import { classService } from "@/services/classService";
import { campusService } from "@/services/campusService";
import { academicYearService } from "@/services/academicYearService";
import type { ClassListResponse } from "@/types/class";
import type { CampusRecord } from "@/types/campus";
import type { AcademicYearRecord } from "@/types/academicYear";
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

export function ClassTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "classes", "create");
  const canExport = hasPermission(user.role, "classes", "export");

  const [result, setResult] = useState<ClassListResponse | null>(null);
  const [campuses, setCampuses] = useState<CampusRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campusId, setCampusId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    campusService.list({ pageSize: 100 }).then((r) => setCampuses(r.data)).catch(() => {});
    academicYearService.list({ pageSize: 50 }).then((r) => setAcademicYears(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      classService
        .list({ q: search || undefined, campusId: campusId || undefined, academicYearId: academicYearId || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load classes."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, campusId, academicYearId, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Class Name", value: (c) => c.name },
      { header: "Class Code", value: (c) => c.code },
      { header: "Academic Year", value: (c) => c.academicYear.label },
      { header: "Campus", value: (c) => c.campus.name },
      { header: "Class Teacher", value: (c) => c.classTeacher?.fullName },
      { header: "Sections", value: (c) => c.counts?.sections ?? 0 },
      { header: "Students", value: (c) => c.counts?.students ?? 0 },
      { header: "Capacity", value: (c) => c.capacity },
      { header: "Status", value: (c) => c.status },
    ]);
    downloadCsv("classes.csv", csv);
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
          value={campusId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setCampusId(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Campus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campuses</SelectItem>
            {campuses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={academicYearId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setAcademicYearId(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
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
        {canExport && (
          <Button variant="secondary" onClick={handleExport} disabled={!result || result.data.length === 0}>
            <Download className="size-4" /> Export
          </Button>
        )}
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/school/classes/new">
              <Plus className="size-4" /> Add Class
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={8} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={School}
          title="No classes found"
          description="Try a different search or filter, or add your first class."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/school/classes/new">
                  <Plus className="size-4" /> Add Class
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
                <TableHead>Class</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Class Teacher</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((cls) => {
                const utilization = cls.capacity ? Math.round(((cls.counts?.students ?? 0) / cls.capacity) * 100) : null;
                return (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.academicYear.label}</TableCell>
                    <TableCell>{cls.campus.name}</TableCell>
                    <TableCell>{cls.classTeacher?.fullName ?? "—"}</TableCell>
                    <TableCell>{cls.counts?.sections ?? 0}</TableCell>
                    <TableCell>
                      {cls.counts?.students ?? 0}
                      {cls.capacity ? ` / ${cls.capacity}` : ""}
                      {utilization !== null && utilization >= 90 && (
                        <Badge variant="warning" className="ml-2">
                          {utilization}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cls.status === "active" ? "success" : "neutral"}>{cls.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/classes/${cls.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} class{result.total === 1 ? "" : "es"}
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
