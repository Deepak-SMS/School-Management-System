"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Layers, Download } from "lucide-react";
import { sectionService } from "@/services/sectionService";
import { classService } from "@/services/classService";
import type { SectionListResponse } from "@/types/section";
import type { ClassRecord } from "@/types/class";
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

export function SectionTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "sections", "create");
  const canExport = hasPermission(user.role, "sections", "export");

  const [result, setResult] = useState<SectionListResponse | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    classService.list({ pageSize: 100 }).then((r) => setClasses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      sectionService
        .list({ q: search || undefined, classId: classId || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load sections."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, classId, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Section Name", value: (s) => s.name },
      { header: "Section Code", value: (s) => s.code },
      { header: "Class", value: (s) => s.class.name },
      { header: "Campus", value: (s) => s.campus.name },
      { header: "Room", value: (s) => s.room },
      { header: "Class Teacher", value: (s) => s.classTeacher?.fullName },
      { header: "Students", value: (s) => s.counts?.students ?? 0 },
      { header: "Capacity", value: (s) => s.capacity },
      { header: "Status", value: (s) => s.status },
    ]);
    downloadCsv("sections.csv", csv);
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
          value={classId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setClassId(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
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
            <Link href="/school/sections/new">
              <Plus className="size-4" /> Add Section
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No sections found"
          description="Try a different search or filter, or add your first section."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/school/sections/new">
                  <Plus className="size-4" /> Add Section
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
                <TableHead>Section</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Class Teacher</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((section) => {
                const utilization = section.capacity ? Math.round(((section.counts?.students ?? 0) / section.capacity) * 100) : null;
                return (
                  <TableRow key={section.id}>
                    <TableCell className="font-medium">{section.name}</TableCell>
                    <TableCell>{section.class.name}</TableCell>
                    <TableCell>{section.room ?? "—"}</TableCell>
                    <TableCell>{section.classTeacher?.fullName ?? "—"}</TableCell>
                    <TableCell>
                      {section.counts?.students ?? 0}
                      {section.capacity ? ` / ${section.capacity}` : ""}
                      {utilization !== null && utilization >= 90 && (
                        <Badge variant="warning" className="ml-2">
                          {utilization}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={section.status === "active" ? "success" : "neutral"}>{section.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/sections/${section.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} section{result.total === 1 ? "" : "s"}
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
