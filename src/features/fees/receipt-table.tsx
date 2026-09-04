"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt as ReceiptIcon, Search } from "lucide-react";
import { receiptService, type ReceiptListResponse } from "@/services/receiptService";
import { PAYMENT_METHOD_LABELS, RECEIPT_STATUSES, type PaymentMethod } from "@/lib/constants/payments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReceiptTable() {
  const [result, setResult] = useState<ReceiptListResponse | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  // Typing shouldn't fire a request per keystroke. The page resets with the
  // debounced term rather than in its own effect, so changing a filter and
  // landing on page 1 is a single render.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  /** Every filter but the search box resets paging as it changes. */
  function applyFilter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  function load() {
    receiptService
      .list({ q: debouncedQ, status, from, to, page, pageSize: 25 })
      .then((r) => {
        setResult(r);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, from, to, page]);

  if (error) return <ErrorState onRetry={load} />;

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search receipt no., student, admission no., reference…"
            className="pl-9"
            aria-label="Search receipts"
          />
        </div>

        <Select value={status} onValueChange={applyFilter(setStatus)}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {RECEIPT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "issued" ? "Issued" : "Void"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input type="date" value={from} onChange={(e) => applyFilter(setFrom)(e.target.value)} className="w-40" aria-label="Paid from" />
        <Input type="date" value={to} onChange={(e) => applyFilter(setTo)(e.target.value)} className="w-40" aria-label="Paid until" />

        <Button asChild>
          <Link href="/fees/payments/new">Record payment</Link>
        </Button>
      </div>

      {result && result.total > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Receipts</p>
              <p className="text-lg font-semibold text-foreground">{result.total}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Collected (excludes voided)</p>
              <p className="text-lg font-semibold text-foreground">Rs. {money(result.totalCollected)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!result ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No receipts yet"
          description="A receipt is issued automatically whenever a payment is recorded."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt No.</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Paid On</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-medium">{r.receiptNumber}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{r.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.admissionNumber}
                      {r.className ? ` · ${r.className}${r.sectionName ? `-${r.sectionName}` : ""}` : ""}
                    </p>
                  </TableCell>
                  <TableCell>{r.paidOn.slice(0, 10)}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method}</TableCell>
                  <TableCell className="text-right font-medium">Rs. {money(r.amountPaid)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">Rs. {money(r.balanceAfter)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "issued" ? "success" : "danger"}>
                      {r.status === "issued" ? "Issued" : "Void"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/fees/receipts/${r.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {result.page} of {pageCount}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
