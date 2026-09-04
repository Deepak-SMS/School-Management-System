"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Download, Mail, Printer } from "lucide-react";
import { receiptService, type ReceiptRecord } from "@/services/receiptService";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants/payments";
import type { ApiError } from "@/services/studentService";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReceiptDetail({ id }: { id: string }) {
  const can = useCan();
  const canExport = can("receipts", "export");
  const canCancel = can("payments", "delete");

  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  function load() {
    receiptService
      .get(id)
      .then((r) => {
        setReceipt(r);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState onRetry={load} />;
  if (!receipt) return <LoadingState className="py-16" />;

  const isVoid = receipt.status === "void";

  async function sendEmail() {
    setActionError(null);
    setSending(true);
    try {
      const result = await receiptService.email(id, emailTo ? { to: emailTo } : {});
      toast({ title: "Receipt sent", description: `Emailed to ${result.sentTo}`, variant: "success" });
      setEmailOpen(false);
      setEmailTo("");
      load();
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "The receipt couldn't be sent.");
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    if (!receipt?.payment) return;
    setActionError(null);
    setCancelling(true);
    try {
      await receiptService.cancelPayment(receipt.payment.id, cancelReason);
      toast({ title: "Payment cancelled", description: "This receipt is now void.", variant: "success" });
      setCancelOpen(false);
      setCancelReason("");
      load();
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "The payment couldn't be cancelled.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/fees/receipts" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to receipts
      </Link>

      {actionError && (
        <Alert variant="danger" title="Couldn't complete that">
          {actionError}
        </Alert>
      )}

      {isVoid && (
        <Alert variant="danger" title="This receipt has been voided">
          {receipt.voidReason ?? "The payment behind it was cancelled."}
          {receipt.voidedAt ? ` (${receipt.voidedAt.slice(0, 10)})` : ""}
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg font-semibold text-foreground">{receipt.receiptNumber}</h1>
            <Badge variant={isVoid ? "danger" : "success"}>{isVoid ? "Void" : "Issued"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {receipt.issuedOn.slice(0, 10)}
            {receipt.payment ? ` · Payment ${receipt.payment.paymentNumber}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Print and Download open the same PDF, so what's printed and what's
              filed can never differ. */}
          <Button asChild variant="secondary" disabled={!canExport}>
            <a href={receiptService.pdfUrl(id)} target="_blank" rel="noreferrer">
              <Printer className="size-4" /> Print
            </a>
          </Button>
          <Button asChild variant="secondary" disabled={!canExport}>
            <a href={receiptService.pdfUrl(id, true)}>
              <Download className="size-4" /> Download PDF
            </a>
          </Button>
          <Button variant="secondary" onClick={() => setEmailOpen(true)} disabled={!canExport || isVoid}>
            <Mail className="size-4" /> Email to parent
          </Button>
          {canCancel && !isVoid && (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              <Ban className="size-4" /> Cancel payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start gap-4 text-sm">
            {/* The logo captured at issue time, not the school's current one. */}
            {receipt.schoolLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receipt.schoolLogoUrl} alt="" className="size-14 shrink-0 rounded object-contain" />
            )}
            <div>
              <p className="font-medium text-foreground">{receipt.schoolName}</p>
              {receipt.schoolAddress && <p className="text-muted-foreground">{receipt.schoolAddress}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Name" value={receipt.studentName} />
            <Field label="Admission no." value={receipt.admissionNumber} />
            <Field
              label="Class"
              value={[receipt.className, receipt.sectionName].filter(Boolean).join(" - ") || undefined}
            />
            <Field label="Academic year" value={receipt.academicYear ?? undefined} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Field label="Paid on" value={receipt.paidOn.slice(0, 10)} />
          <Field label="Method" value={PAYMENT_METHOD_LABELS[receipt.method as PaymentMethod] ?? receipt.method} />
          <Field label="Reference" value={receipt.referenceNo ?? undefined} />
          <Field label="Bank" value={receipt.payment?.bankName ?? undefined} />
          <Field label="Invoice reference" value={receipt.invoiceRef ?? undefined} />
          <Field label="Emailed to" value={receipt.emailedTo ?? undefined} />
          <Field label="Emailed on" value={receipt.emailedAt?.slice(0, 10)} />
          <Field label="Note" value={receipt.payment?.note ?? undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee components</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Charged</TableHead>
                <TableHead className="text-right">Paid now</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(receipt.components ?? []).map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell className="text-muted-foreground">{c.category}</TableCell>
                  <TableCell className="text-right">Rs. {money(c.charged)}</TableCell>
                  <TableCell className="text-right font-medium">Rs. {money(c.paidNow)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">Rs. {money(c.outstanding)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
            <div className="flex gap-8">
              <span className="text-muted-foreground">Amount paid</span>
              <span className="w-32 text-right text-lg font-semibold text-foreground">Rs. {money(receipt.amountPaid)}</span>
            </div>
            <div className="flex gap-8">
              <span className="text-muted-foreground">Balance after this payment</span>
              <span className="w-32 text-right text-foreground">Rs. {money(receipt.balanceAfter)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal open={emailOpen} onOpenChange={setEmailOpen}>
        <ModalContent title="Email receipt to parent">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            The receipt PDF is attached. Leave the address blank to use the parent email on the student&apos;s record.
          </p>
          <Input
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="parent@example.com (optional)"
            aria-label="Send to"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendEmail} isLoading={sending}>
              <Mail className="size-4" /> Send
            </Button>
          </div>
        </div>
        </ModalContent>
      </Modal>

      <Modal open={cancelOpen} onOpenChange={setCancelOpen}>
        <ModalContent title="Cancel this payment?">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            This voids receipt {receipt.receiptNumber} and returns Rs. {money(receipt.amountPaid)} to the student&apos;s
            outstanding balance. Nothing is deleted — the receipt stays on the record, marked void. The family may already
            hold a printed copy.
          </p>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this being cancelled?"
            aria-label="Reason"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={cancel} isLoading={cancelling} disabled={cancelReason.trim().length < 5}>
              Cancel payment
            </Button>
          </div>
        </div>
        </ModalContent>
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
