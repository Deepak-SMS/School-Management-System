"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, Search } from "lucide-react";
import { receiptService, type StudentBalanceResponse } from "@/services/receiptService";
import { studentService } from "@/services/studentService";
import type { StudentRecord } from "@/types/student";
import type { ApiError } from "@/services/studentService";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  METHODS_REQUIRING_REFERENCE,
  METHODS_WITH_BANK,
  type PaymentMethod,
} from "@/lib/constants/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentForm() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [balance, setBalance] = useState<StudentBalanceResponse | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [paidOn, setPaidOn] = useState(today());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const searchable = query.trim().length >= 2;

  // Debounce and fetch in one effect: everything that sets state runs in the
  // timer callback, so typing never triggers a render just to record that a
  // search is pending.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;

    const timer = setTimeout(() => {
      setSearching(true);
      studentService
        .list({ q: term, pageSize: 8, status: "active" })
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function choose(student: StudentRecord) {
    setResults([]);
    setQuery(`${student.firstName} ${student.lastName} (${student.admissionNumber})`);
    setLoadingBalance(true);
    setError(null);
    receiptService
      .studentBalance(student.id)
      .then((b) => {
        setBalance(b);
        // Pre-fill with everything owed; the cashier edits it down for a part payment.
        setAmount(b.totalOutstanding > 0 ? String(b.totalOutstanding) : "");
      })
      .catch((e) => setError((e as ApiError)?.error ?? "Couldn't load this student's fees."))
      .finally(() => setLoadingBalance(false));
  }

  // Derived rather than cleared in the effect: too short a query simply shows
  // nothing, instead of a render that empties the list.
  const visibleResults = searchable ? results : [];

  const needsReference = METHODS_REQUIRING_REFERENCE.includes(method);
  const needsBank = METHODS_WITH_BANK.includes(method);
  const amountNumber = Number(amount);
  const overpaying = balance !== null && amountNumber > balance.totalOutstanding;

  async function submit() {
    if (!balance) return;
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await receiptService.recordPayment({
        studentId: balance.student.id,
        paidOn,
        amount: amountNumber,
        method,
        referenceNo: referenceNo || undefined,
        bankName: bankName || undefined,
        invoiceRef: invoiceRef || undefined,
        note: note || undefined,
      });

      toast({
        title: "Payment recorded",
        description: `Receipt ${result.receipt.receiptNumber} issued.`,
        variant: "success",
      });
      // Straight to the receipt — the next thing anyone does is print or send it.
      router.push(`/fees/receipts/${result.receipt.id}`);
    } catch (e) {
      const err = e as ApiError;
      setError(err?.error ?? "The payment couldn't be recorded.");
      setFieldErrors((err?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="danger" title="Couldn't record this payment">
          {error}
          {Object.values(fieldErrors).flat().length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {Object.values(fieldErrors)
                .flat()
                .map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
            </ul>
          )}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Student</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setBalance(null);
              }}
              placeholder="Search by name or admission number…"
              className="pl-9"
              aria-label="Find student"
            />
          </div>

          {searching && searchable && <p className="text-sm text-muted-foreground">Searching…</p>}

          {visibleResults.length > 0 && (
            <ul className="flex flex-col rounded-md border border-border">
              {visibleResults.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span className="font-medium text-foreground">
                      {s.firstName} {s.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.admissionNumber} · {s.class.name}
                      {s.section ? `-${s.section.name}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {loadingBalance && <LoadingState className="py-8" />}

      {balance && !loadingBalance && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Outstanding fees</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {balance.charges.length === 0 ? (
                <EmptyState
                  icon={IndianRupee}
                  title="No fees charged yet"
                  description="This student has no fee charges, so there is nothing to pay against. Assign a fee structure first."
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Charged</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balance.charges.map((c) => (
                        <TableRow key={c.chargeId}>
                          <TableCell className="font-medium">{c.label}</TableCell>
                          <TableCell className="text-muted-foreground">{c.dueDate?.slice(0, 10) ?? "—"}</TableCell>
                          <TableCell className="text-right">Rs. {money(c.charged)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">Rs. {money(c.paid)}</TableCell>
                          <TableCell className="text-right font-medium">Rs. {money(c.outstanding)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-right text-sm">
                    <span className="text-muted-foreground">Total outstanding </span>
                    <span className="text-lg font-semibold text-foreground">Rs. {money(balance.totalOutstanding)}</span>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {balance.totalOutstanding > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment received</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField label="Amount" required>
                  {(f) => (
                    <Input
                      {...f}
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  )}
                </FormField>

                <FormField label="Paid on" required>
                  {(f) => <Input {...f} type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
                </FormField>

                <FormField label="Method" required>
                  {() => (
                    <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>

                {needsReference && (
                  <FormField
                    label="Reference number"
                    required
                    description="Cheque no., UPI reference, or transaction id"
                  >
                    {(f) => <Input {...f} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />}
                  </FormField>
                )}

                {needsBank && (
                  <FormField label="Bank">
                    {(f) => <Input {...f} value={bankName} onChange={(e) => setBankName(e.target.value)} />}
                  </FormField>
                )}

                <FormField label="Invoice reference" description="Optional, until Invoices are in use">
                  {(f) => <Input {...f} value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />}
                </FormField>

                <FormField label="Note" className="sm:col-span-2">
                  {(f) => <Input {...f} value={note} onChange={(e) => setNote(e.target.value)} />}
                </FormField>

                <div className="flex flex-col gap-3 sm:col-span-2">
                  {overpaying && (
                    <Alert variant="warning" title="More than is outstanding">
                      Rs. {money(amountNumber - balance.totalOutstanding)} of this can&apos;t be applied to a current
                      charge. It will be recorded on the receipt as unallocated.
                    </Alert>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The payment settles the oldest due charges first, and a receipt is issued automatically.
                  </p>
                  <div>
                    <Button onClick={submit} isLoading={submitting} disabled={!(amountNumber > 0)}>
                      Record payment &amp; issue receipt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
