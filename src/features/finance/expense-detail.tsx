"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Check, FileText, Paperclip, Send, Trash2, Wallet, X } from "lucide-react";
import { expenseService, type ExpenseRecord } from "@/services/expenseService";
import type { ApiError } from "@/services/studentService";
import {
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_TONES,
  EXPENSE_ATTACHMENT_KIND_LABELS,
  type ExpenseStatus,
} from "@/lib/constants/expenses";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants/payments";
import { allowedTransitions, isEditable } from "@/lib/finance/expense-workflow";
import { useCan } from "@/hooks/use-can";
import { useCurrentUser } from "@/providers/user-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal, ModalContent } from "@/components/ui/modal";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Prompt = { to: ExpenseStatus; title: string; body: string; requiresReason: boolean } | null;

export function ExpenseDetail({ id }: { id: string }) {
  const router = useRouter();
  const can = useCan();
  const user = useCurrentUser();

  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [prompt, setPrompt] = useState<Prompt>(null);
  const [reason, setReason] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function load() {
    expenseService
      .get(id)
      .then((e) => {
        setExpense(e);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState onRetry={load} />;
  if (!expense) return <LoadingState className="py-16" />;

  const status = expense.status;
  const allowed = allowedTransitions(status);
  const editable = isEditable(status);

  // Mirrors the server's rule so a button that would 403 isn't offered. The
  // server check is the control; this only avoids a pointless click.
  const submittedByMe = expense.events?.some((e) => e.toStatus === "submitted" && e.actorName === user.name) ?? false;

  const canSubmit = can("expenses", "create") && allowed.includes("submitted");
  const canDecide = can("expenses", "approve") && allowed.includes("approved") && !submittedByMe;
  const canPay = can("expenses", "edit") && allowed.includes("paid");
  const canCancel = can("expenses", "edit") && allowed.includes("cancelled");
  const canDelete = can("expenses", "delete") && status === "draft";

  async function move(to: ExpenseStatus, note?: string) {
    setActionError(null);
    setBusy(true);
    try {
      await expenseService.transition(id, { to, note });
      toast({ title: `Expense ${EXPENSE_STATUS_LABELS[to].toLowerCase()}`, variant: "success" });
      setPrompt(null);
      setReason("");
      load();
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setActionError(null);
    setUploading(true);
    try {
      await expenseService.uploadBill(id, file);
      toast({ title: "Bill attached", variant: "success" });
      load();
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "The bill couldn't be attached.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAttachment(attachmentId: string) {
    setActionError(null);
    try {
      await expenseService.removeAttachment(id, attachmentId);
      load();
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "The bill couldn't be removed.");
    }
  }

  async function destroy() {
    setActionError(null);
    setBusy(true);
    try {
      await expenseService.remove(id);
      toast({ title: "Draft deleted", variant: "success" });
      router.push("/finance/expenses");
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "The draft couldn't be deleted.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/finance/expenses"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to expenses
      </Link>

      {actionError && (
        <Alert variant="danger" title="Couldn't complete that">
          {actionError}
        </Alert>
      )}

      {status === "rejected" && expense.rejectionReason && (
        <Alert variant="danger" title="Sent back for correction">
          {expense.rejectionReason}
        </Alert>
      )}

      {status === "cancelled" && expense.cancelReason && (
        <Alert variant="warning" title="This expense was cancelled">
          {expense.cancelReason}
        </Alert>
      )}

      {can("expenses", "approve") && status === "submitted" && submittedByMe && (
        <Alert variant="warning" title="You submitted this one">
          Someone else with approval rights has to review it. The server refuses a self-approval even if this is your own
          department&apos;s spend.
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{expense.title}</h1>
            <Badge variant={EXPENSE_STATUS_TONES[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{expense.expenseNumber}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {editable && can("expenses", "edit") && (
            <Button asChild variant="secondary">
              <Link href={`/finance/expenses/${id}/edit`}>Edit</Link>
            </Button>
          )}
          {canSubmit && (
            <Button
              onClick={() =>
                setPrompt({
                  to: "submitted",
                  title: "Send for approval?",
                  body: "It goes to someone with approval rights. You won't be able to edit it while it's with them.",
                  requiresReason: false,
                })
              }
            >
              <Send className="size-4" /> Send for approval
            </Button>
          )}
          {canDecide && (
            <>
              <Button
                onClick={() =>
                  setPrompt({
                    to: "approved",
                    title: "Approve this expense?",
                    body: `Approving Rs. ${money(expense.amount)} to ${expense.payeeName}. It can then be marked paid.`,
                    requiresReason: false,
                  })
                }
              >
                <Check className="size-4" /> Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  setPrompt({
                    to: "rejected",
                    title: "Reject this expense?",
                    body: "It goes back to whoever raised it, with your reason attached.",
                    requiresReason: true,
                  })
                }
              >
                <X className="size-4" /> Reject
              </Button>
            </>
          )}
          {canPay && (
            <Button
              onClick={() =>
                setPrompt({
                  to: "paid",
                  title: "Mark as paid?",
                  body: `Records that Rs. ${money(expense.amount)} has actually left the school. This can't be undone.`,
                  requiresReason: false,
                })
              }
            >
              <Wallet className="size-4" /> Mark as paid
            </Button>
          )}
          {canCancel && (
            <Button
              variant="secondary"
              onClick={() =>
                setPrompt({
                  to: "cancelled",
                  title: "Cancel this expense?",
                  body: "The record stays, marked cancelled, with your reason.",
                  requiresReason: true,
                })
              }
            >
              <Ban className="size-4" /> Cancel
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={destroy} isLoading={busy}>
              <Trash2 className="size-4" /> Delete draft
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Field label="Category" value={expense.category?.name} />
          <Field label="Date" value={expense.expenseDate.slice(0, 10)} />
          <Field label="Amount" value={`Rs. ${money(expense.amount)}`} />
          <Field label="Of which tax" value={expense.taxAmount ? `Rs. ${money(expense.taxAmount)}` : "—"} />
          <Field label="Vendor / payee" value={expense.payeeName} />
          <Field label="Contact" value={expense.payeeContact} />
          <Field label="GSTIN" value={expense.payeeGstin} />
          <Field
            label="Payment method"
            value={expense.paymentMethod ? PAYMENT_METHOD_LABELS[expense.paymentMethod as PaymentMethod] : undefined}
          />
          <Field label="Reference" value={expense.referenceNo} />
          <Field label="Bank" value={expense.bankName} />
          <Field label="Paid on" value={expense.paidOn?.slice(0, 10)} />
          <Field label="Note" value={expense.note} />
          {expense.description && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-foreground">{expense.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bills &amp; invoices</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(expense.attachments?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">
              Nothing attached yet.
              {editable ? " Attach the bill before sending this for approval." : ""}
            </p>
          ) : (
            expense.attachments!.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {a.label || a.uploadedFile?.originalName || "Attachment"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {EXPENSE_ATTACHMENT_KIND_LABELS[a.kind as keyof typeof EXPENSE_ATTACHMENT_KIND_LABELS] ?? a.kind}
                  </p>
                </div>
                <a
                  href={`/api/files/${a.uploadedFileId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary-600 underline-offset-4 hover:underline"
                >
                  View
                </a>
                {editable && can("expenses", "edit") && (
                  <Button variant="ghost" size="sm" onClick={() => removeAttachment(a.id)}>
                    Remove
                  </Button>
                )}
              </div>
            ))
          )}

          {editable && can("expenses", "edit") && (
            <div>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                }}
              />
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} isLoading={uploading}>
                <Paperclip className="size-4" /> Attach bill
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(expense.events ?? []).map((e) => (
            <div key={e.id} className="flex gap-3 border-l-2 border-border pl-3">
              <div>
                <p className="font-medium text-foreground">
                  {e.fromStatus ? `${EXPENSE_STATUS_LABELS[e.fromStatus as ExpenseStatus]} → ` : ""}
                  {EXPENSE_STATUS_LABELS[e.toStatus as ExpenseStatus] ?? e.toStatus}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.occurredAt.slice(0, 10)} {e.occurredAt.slice(11, 16)}
                  {e.actorName ? ` · ${e.actorName}` : ""}
                </p>
                {e.note && <p className="mt-1 text-muted-foreground">{e.note}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Modal open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)}>
        <ModalContent title={prompt?.title ?? ""}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-muted-foreground">{prompt?.body}</p>
            {prompt?.requiresReason && (
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason"
                aria-label="Reason"
              />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPrompt(null)}>
                Back
              </Button>
              <Button
                onClick={() => prompt && move(prompt.to, reason || undefined)}
                isLoading={busy}
                disabled={prompt?.requiresReason && reason.trim().length < 5}
              >
                Confirm
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
