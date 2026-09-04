"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Receipt, Search } from "lucide-react";
import {
  expenseService,
  type ExpenseCategoryRecord,
  type ExpenseListResponse,
} from "@/services/expenseService";
import {
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_TONES,
  type ExpenseStatus,
} from "@/lib/constants/expenses";
import { useCan } from "@/hooks/use-can";
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

export function ExpenseTable() {
  const can = useCan();
  const canCreate = can("expenses", "create");
  const canApprove = can("expenses", "approve");

  const [result, setResult] = useState<ExpenseListResponse | null>(null);
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [error, setError] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedQ, setDebouncedQ] = useState("");

  // Typing shouldn't fire a request per keystroke; the page resets alongside the
  // debounced term rather than in an effect of its own.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    expenseService
      .listCategories()
      .then((r) => setCategories(r.data))
      .catch(() => setCategories([]));
  }, []);

  function load() {
    expenseService
      .list({ q: debouncedQ, status, categoryId, from, to, page, pageSize: 25 })
      .then((r) => {
        setResult(r);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, categoryId, from, to, page]);

  /** Every filter but the search box resets paging as it changes. */
  function applyFilter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  if (error) return <ErrorState onRetry={load} />;

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const awaiting = result?.totals.byStatus.submitted?.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {canApprove && awaiting > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <p>
              <span className="font-medium text-foreground">
                {awaiting} expense{awaiting === 1 ? "" : "s"} awaiting your approval
              </span>
              <span className="text-muted-foreground"> · Rs. {money(result?.totals.awaitingApproval ?? 0)}</span>
            </p>
            <Button variant="secondary" size="sm" onClick={() => applyFilter(setStatus)("submitted")}>
              Review them
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search number, title, payee, reference…"
            className="pl-9"
            aria-label="Search expenses"
          />
        </div>

        <Select value={status} onValueChange={applyFilter(setStatus)}>
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {EXPENSE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {EXPENSE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryId} onValueChange={applyFilter(setCategoryId)}>
          <SelectTrigger className="w-48" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={from}
          onChange={(e) => applyFilter(setFrom)(e.target.value)}
          className="w-40"
          aria-label="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => applyFilter(setTo)(e.target.value)}
          className="w-40"
          aria-label="To date"
        />

        {canCreate && (
          <Button asChild>
            <Link href="/finance/expenses/new">
              <Plus className="size-4" /> Record expense
            </Link>
          </Button>
        )}
      </div>

      {result && result.total > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-baseline gap-x-10 gap-y-3 py-4 text-sm">
            <Total label="Expenses" value={String(result.total)} />
            <Total label="Awaiting approval" value={`Rs. ${money(result.totals.awaitingApproval)}`} />
            <Total label="Approved, unpaid" value={`Rs. ${money(result.totals.approvedUnpaid)}`} />
            <Total label="Paid" value={`Rs. ${money(result.totals.paid)}`} />
          </CardContent>
        </Card>
      )}

      {!result ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses here"
          description={
            q || status || categoryId || from || to
              ? "Nothing matches those filters."
              : "Record what the school spends — bills, salaries, rent, repairs — and send it for approval."
          }
          action={
            canCreate ? (
              <Button asChild>
                <Link href="/finance/expenses/new">
                  <Plus className="size-4" /> Record expense
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.expenseNumber}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{e.title}</p>
                    {(e.attachments?.length ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {e.attachments!.length} bill{e.attachments!.length === 1 ? "" : "s"} attached
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.category?.name ?? "—"}</TableCell>
                  <TableCell>{e.payeeName}</TableCell>
                  <TableCell>{e.expenseDate.slice(0, 10)}</TableCell>
                  <TableCell className="text-right font-medium">Rs. {money(e.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={EXPENSE_STATUS_TONES[e.status as ExpenseStatus]}>
                      {EXPENSE_STATUS_LABELS[e.status as ExpenseStatus] ?? e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/finance/expenses/${e.id}`}>View</Link>
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

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
