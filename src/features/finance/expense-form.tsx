"use client";

import { useEffect, useState } from "react";
import { expenseService, type ExpenseCategoryRecord, type ExpenseRecord } from "@/services/expenseService";
import type { ExpenseInput } from "@/lib/validation/expense";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({
  expense,
  submitLabel = "Save draft",
  onSaved,
}: {
  expense?: ExpenseRecord;
  submitLabel?: string;
  onSaved: (expense: ExpenseRecord) => void;
}) {
  const [categories, setCategories] = useState<ExpenseCategoryRecord[] | null>(null);

  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const [title, setTitle] = useState(expense?.title ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [taxAmount, setTaxAmount] = useState(expense?.taxAmount ? String(expense.taxAmount) : "");
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate.slice(0, 10) ?? today());

  const [payeeName, setPayeeName] = useState(expense?.payeeName ?? "");
  const [payeeContact, setPayeeContact] = useState(expense?.payeeContact ?? "");
  const [payeeGstin, setPayeeGstin] = useState(expense?.payeeGstin ?? "");

  const [paymentMethod, setPaymentMethod] = useState<string>(expense?.paymentMethod ?? "");
  const [referenceNo, setReferenceNo] = useState(expense?.referenceNo ?? "");
  const [bankName, setBankName] = useState(expense?.bankName ?? "");
  const [note, setNote] = useState(expense?.note ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  useEffect(() => {
    expenseService
      .listCategories()
      .then((r) => setCategories(r.data))
      .catch(() => setCategories([]));
  }, []);

  const method = paymentMethod as PaymentMethod;
  const needsReference = Boolean(paymentMethod) && METHODS_REQUIRING_REFERENCE.includes(method);
  const needsBank = Boolean(paymentMethod) && METHODS_WITH_BANK.includes(method);

  async function save() {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const input = {
      categoryId,
      title,
      description: description || undefined,
      amount: Number(amount),
      taxAmount: taxAmount ? Number(taxAmount) : undefined,
      expenseDate,
      payeeName,
      payeeContact: payeeContact || undefined,
      payeeGstin: payeeGstin || undefined,
      paymentMethod: (paymentMethod || undefined) as ExpenseInput["paymentMethod"],
      referenceNo: referenceNo || undefined,
      bankName: bankName || undefined,
      note: note || undefined,
    } satisfies ExpenseInput;

    try {
      const saved = expense
        ? await expenseService.update(expense.id, input)
        : await expenseService.create(input);
      onSaved(saved);
    } catch (e) {
      const err = e as ApiError;
      setError(err?.error ?? "The expense couldn't be saved.");
      setFieldErrors(err?.fieldErrors ?? {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="danger" title="Couldn't save this expense">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What was spent</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category" required error={fieldErrors.categoryId?.[0]}>
            {() => (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={categories === null ? "Loading…" : "Choose a category"} />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Date" required error={fieldErrors.expenseDate?.[0]}>
            {(f) => (
              <Input
                {...f}
                type="date"
                max={today()}
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Title" required className="sm:col-span-2" error={fieldErrors.title?.[0]}>
            {(f) => (
              <Input
                {...f}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="August electricity bill — Main Campus"
              />
            )}
          </FormField>

          <FormField
            label="Amount (total, including tax)"
            required
            error={fieldErrors.amount?.[0]}
          >
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

          <FormField label="Of which tax" description="Optional — where the bill states it" error={fieldErrors.taxAmount?.[0]}>
            {(f) => (
              <Input
                {...f}
                type="number"
                step="0.01"
                min="0"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="0.00"
              />
            )}
          </FormField>

          <FormField label="Description" className="sm:col-span-2">
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this covers, and anything the approver should know."
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who was paid</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Vendor / payee" required error={fieldErrors.payeeName?.[0]}>
            {(f) => (
              <Input {...f} value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="MSEB" />
            )}
          </FormField>

          <FormField label="Contact" description="Phone or email">
            {(f) => <Input {...f} value={payeeContact} onChange={(e) => setPayeeContact(e.target.value)} />}
          </FormField>

          <FormField label="GSTIN" description="Optional">
            {(f) => <Input {...f} value={payeeGstin} onChange={(e) => setPayeeGstin(e.target.value)} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it is being paid</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Payment method" description="Can be filled in later, when it's actually paid">
            {() => (
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Not decided yet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not decided yet</SelectItem>
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
            <FormField label="Reference number" description="Cheque no., UPI reference, or transaction id">
              {(f) => <Input {...f} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />}
            </FormField>
          )}

          {needsBank && (
            <FormField label="Bank">
              {(f) => <Input {...f} value={bankName} onChange={(e) => setBankName(e.target.value)} />}
            </FormField>
          )}

          <FormField label="Internal note" className="sm:col-span-2">
            {(f) => <Input {...f} value={note} onChange={(e) => setNote(e.target.value)} />}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} isLoading={submitting} disabled={!categoryId || !title || !payeeName || !(Number(amount) > 0)}>
          {submitLabel}
        </Button>
        <p className="text-xs text-muted-foreground">
          Saved as a draft first. Attach the bill, then send it for approval.
        </p>
      </div>
    </div>
  );
}
