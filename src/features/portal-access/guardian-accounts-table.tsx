"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { GuardianAccessDialog, type GuardianAccountRow } from "@/features/portal-access/guardian-access-dialog";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import type { ApiError } from "@/services/studentService";

interface GuardianAccountsResponse {
  data: GuardianAccountRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export function GuardianAccountsTable() {
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [result, setResult] = useState<GuardianAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState<GuardianAccountRow | null>(null);

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => {});
  }, []);

  const sections = useMemo(
    () => structure?.classes.find((c) => c.id === classId)?.sections ?? [],
    [structure, classId],
  );

  function load() {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) query.set("q", search);
    if (classId) query.set("classId", classId);
    if (sectionId) query.set("sectionId", sectionId);
    fetch(`/api/guardians?${query.toString()}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body as ApiError;
        return body as GuardianAccountsResponse;
      })
      .then(setResult)
      .catch(() => setError("Couldn't load guardians."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classId, sectionId, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name, mobile, email..."
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
            setSectionId("");
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {structure?.classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sectionId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setSectionId(v === "all" ? "" : v);
          }}
          disabled={!classId}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <TableSkeleton rows={8} columns={5} />}

      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState icon={Users} title="No guardians found" description="Try a different search." />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guardian</TableHead>
                <TableHead>Children</TableHead>
                <TableHead>Login email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((guardian) => (
                <TableRow key={guardian.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={guardian.fullName.slice(0, 2).toUpperCase()} size="sm" />
                      <span className="font-medium">{guardian.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {guardian.students.length === 0
                      ? "—"
                      : guardian.students
                          .map((s) => `${s.student.firstName} ${s.student.lastName}${s.canAccessPortal ? "" : " (off)"}`)
                          .join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{guardian.user?.email ?? "—"}</TableCell>
                  <TableCell>
                    {!guardian.user && <Badge variant="neutral">No login</Badge>}
                    {guardian.user?.isActive && !guardian.user.mustChangePassword && (
                      <Badge variant="success">Active</Badge>
                    )}
                    {guardian.user?.isActive && guardian.user.mustChangePassword && (
                      <Badge variant="warning">Password reset required</Badge>
                    )}
                    {guardian.user && !guardian.user.isActive && <Badge variant="danger">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setManaging(guardian)}>
                      Manage access
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} guardian{result.total === 1 ? "" : "s"}
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

      {managing && (
        <GuardianAccessDialog
          guardian={managing}
          onClose={() => setManaging(null)}
          onSaved={() => {
            setManaging(null);
            load();
          }}
        />
      )}
    </div>
  );
}
