"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, FileText, Download } from "lucide-react";
import { salarySlipService } from "@/services/payrollService";
import type { SalarySlipRecord } from "@/types/payroll";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PAGE_SIZE = 20;

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SalarySlipTable() {
  const [result, setResult] = useState<{ data: SalarySlipRecord[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      salarySlipService
        .list({ q: search || undefined, page, pageSize: PAGE_SIZE })
        .then(setResult)
        .catch(() => setError("Couldn't load salary slips."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full max-w-xs">
        <Input
          leadingIcon={<Search />}
          placeholder="Search by name, employee ID, slip no..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {loading && <TableSkeleton rows={8} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={() => setPage((p) => p)} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState icon={FileText} title="No salary slips found" description="Slips appear here once a payroll period is locked and slips are generated." />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slip No.</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((slip) => (
                <TableRow key={slip.id}>
                  <TableCell className="font-mono text-muted-foreground">{slip.slipNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{slip.staff.fullName}</div>
                    <div className="text-xs text-muted-foreground">{slip.staff.employeeId}</div>
                  </TableCell>
                  <TableCell>
                    {MONTH_NAMES[slip.period.month - 1]} {slip.period.year}
                  </TableCell>
                  <TableCell>₹{money(slip.netSalary)}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(slip.generatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="text-right">
                    {slip.pdfUrl && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={slip.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="size-4" /> Download
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} slip{result.total === 1 ? "" : "s"}
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
