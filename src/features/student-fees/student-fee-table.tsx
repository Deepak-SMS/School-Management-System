"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Wallet } from "lucide-react";
import { studentFeeService } from "@/services/studentFeeService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import type { StudentFeeListResponse } from "@/types/student-fees";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
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

export function StudentFeeTable() {
  const [result, setResult] = useState<StudentFeeListResponse | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [balance, setBalance] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    classService.list({ pageSize: 100 }).then((r) => setClasses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) return;
    sectionService.list({ classId, pageSize: 100 }).then((r) => setSections(r.data)).catch(() => setSections([]));
  }, [classId]);
  const visibleSections = classId ? sections : [];

  function load() {
    setLoading(true);
    setError(null);
    studentFeeService
      .list({
        q: search || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        balance: (balance as "outstanding" | "overdue" | "cleared") || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then(setResult)
      .catch(() => setError("Couldn't load student fees."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classId, sectionId, balance, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name, admission no..."
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
          <SelectTrigger className="w-36">
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
        <Select
          value={sectionId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setSectionId(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-36" disabled={!classId}>
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {visibleSections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={balance || "all"}
          onValueChange={(v) => {
            setPage(1);
            setBalance(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Balance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every balance</SelectItem>
            <SelectItem value="outstanding">Outstanding</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="No fee accounts found"
          description="A student gets a fee account once a published fee structure applies to them — try a different filter, or publish a fee structure first."
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Payable</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map(({ student, summary }) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={`${student.firstName[0]}${student.lastName[0]}`} src={student.photoUrl ?? undefined} size="sm" />
                      <div>
                        <Link href={`/fees/student-fees/${student.id}`} className="font-medium hover:underline">
                          {student.firstName} {student.lastName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{student.admissionNumber}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.class.name}
                    {student.section ? ` - ${student.section.name}` : ""}
                  </TableCell>
                  <TableCell>₹{summary.totalCharged.toLocaleString("en-IN")}</TableCell>
                  <TableCell>₹{summary.totalPaid.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Badge variant={summary.totalPending > 0 ? "warning" : "success"}>
                      ₹{summary.totalPending.toLocaleString("en-IN")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {summary.totalOverdue > 0 ? (
                      <Badge variant="danger">₹{summary.totalOverdue.toLocaleString("en-IN")}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/fees/student-fees/${student.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} student{result.total === 1 ? "" : "s"}
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
