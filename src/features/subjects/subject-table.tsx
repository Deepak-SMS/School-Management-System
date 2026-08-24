"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, BookOpen, Download } from "lucide-react";
import { subjectService } from "@/services/subjectService";
import type { SubjectListResponse } from "@/types/subject";
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from "@/lib/constants/school";
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

export function SubjectTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "subjects", "create");
  const canExport = hasPermission(user.role, "subjects", "export");

  const [result, setResult] = useState<SubjectListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      subjectService
        .list({ q: search || undefined, subjectType: subjectType || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load subjects."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, subjectType, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  function handleExport() {
    if (!result) return;
    const csv = toCsv(result.data, [
      { header: "Subject Name", value: (s) => s.name },
      { header: "Subject Code", value: (s) => s.code },
      { header: "Type", value: (s) => SUBJECT_TYPE_LABELS[s.subjectType as keyof typeof SUBJECT_TYPE_LABELS] ?? s.subjectType },
      { header: "Classes", value: (s) => s.counts?.classes ?? 0 },
      { header: "Teachers", value: (s) => s.counts?.teachers ?? 0 },
      { header: "Max Marks", value: (s) => s.maxMarks },
      { header: "Passing Marks", value: (s) => s.passingMarks },
      { header: "Credits", value: (s) => s.credits },
      { header: "Status", value: (s) => s.status },
    ]);
    downloadCsv("subjects.csv", csv);
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
          value={subjectType || "all"}
          onValueChange={(v) => {
            setPage(1);
            setSubjectType(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SUBJECT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {SUBJECT_TYPE_LABELS[t]}
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
            <Link href="/school/subjects/new">
              <Plus className="size-4" /> Add Subject
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No subjects found"
          description="Try a different search or filter, or add your first subject."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/school/subjects/new">
                  <Plus className="size-4" /> Add Subject
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
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Teachers</TableHead>
                <TableHead>Max / Passing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{SUBJECT_TYPE_LABELS[subject.subjectType as keyof typeof SUBJECT_TYPE_LABELS] ?? subject.subjectType}</TableCell>
                  <TableCell>{subject.counts?.classes ?? 0}</TableCell>
                  <TableCell>{subject.counts?.teachers ?? 0}</TableCell>
                  <TableCell>
                    {subject.maxMarks ?? "—"} / {subject.passingMarks ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subject.status === "active" ? "success" : "neutral"}>{subject.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/school/subjects/${subject.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} subject{result.total === 1 ? "" : "s"}
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
