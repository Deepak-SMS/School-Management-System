"use client";

import { useEffect, useState } from "react";
import { Wallet, CreditCard, Clock, AlertTriangle, Percent, Plus, HandCoins, ArrowRightLeft, Trash2 } from "lucide-react";
import { studentFeeService } from "@/services/studentFeeService";
import { studentService } from "@/services/studentService";
import { feeCategoryService } from "@/services/feeStructureService";
import type { StudentFeeAccountRecord, StudentFeeChargeRecord, AvailableFeeItemRecord } from "@/types/student-fees";
import type { FeeCategoryRecord } from "@/types/fees";
import type { StudentRecord } from "@/types/student";
import { STUDENT_FEE_ADJUSTMENT_TYPES, STUDENT_FEE_ADJUSTMENT_LABELS } from "@/lib/constants/student-fees";
import { useCan } from "@/hooks/use-can";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const ADJUSTMENT_LABELS = STUDENT_FEE_ADJUSTMENT_LABELS as Record<string, string>;

export function StudentFeeDetail({ studentId }: { studentId: string }) {
  const can = useCan();
  const [account, setAccount] = useState<StudentFeeAccountRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addChargeOpen, setAddChargeOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<StudentFeeChargeRecord | null>(null);
  const [transferring, setTransferring] = useState<StudentFeeChargeRecord | null>(null);
  const [removing, setRemoving] = useState<StudentFeeChargeRecord | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  function load() {
    studentFeeService
      .get(studentId)
      .then((a) => {
        setAccount(a);
        setError(null);
      })
      .catch(() => setError("Couldn't load this student's fee account."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!account) return <LoadingState />;

  const canCreate = can("studentFees", "create");
  const canEdit = can("studentFees", "edit");
  const canDelete = can("studentFees", "delete");
  const canTransfer = can("studentFees", "transfer");

  async function confirmRemove() {
    if (!removing) return;
    setIsRemoving(true);
    try {
      const result = await studentFeeService.removeCharge(studentId, removing.id);
      toast({ title: result.cancelled ? "Charge cancelled" : "Charge removed", variant: "success" });
      setRemoving(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the charge.", variant: "danger" });
    } finally {
      setIsRemoving(false);
    }
  }

  const { student, summary, charges, adjustments } = account;
  const activeCharges = charges.filter((c) => c.status !== "cancelled");
  const cancelledCharges = charges.filter((c) => c.status === "cancelled");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar initials={`${student.firstName[0]}${student.lastName[0]}`} src={student.photoUrl ?? undefined} size="lg" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {student.firstName} {student.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {student.admissionNumber} · {student.class.name}
              {student.section ? ` - ${student.section.name}` : ""}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setAddChargeOpen(true)}>
            <Plus className="size-4" /> Add charge
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Payable" value={`₹${summary.totalCharged.toLocaleString("en-IN")}`} icon={Wallet} tone="primary" />
        <StatCard label="Paid" value={`₹${summary.totalPaid.toLocaleString("en-IN")}`} icon={CreditCard} tone="success" />
        <StatCard
          label="Pending"
          value={`₹${summary.totalPending.toLocaleString("en-IN")}`}
          icon={Clock}
          tone={summary.totalPending > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Overdue"
          value={`₹${summary.totalOverdue.toLocaleString("en-IN")}`}
          icon={AlertTriangle}
          tone={summary.totalOverdue > 0 ? "danger" : "neutral"}
        />
        <StatCard label="Waived" value={`₹${summary.totalWaived.toLocaleString("en-IN")}`} icon={Percent} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Charges</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeCharges.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No charges yet"
              description="Charges appear once a published fee structure applies to this student, or you add one."
              className="py-10"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Waived</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCharges.map((charge) => {
                  const overdue = charge.outstandingAmount > 0 && Boolean(charge.dueDate) && new Date(charge.dueDate as string) < new Date();
                  return (
                    <TableRow key={charge.id}>
                      <TableCell>
                        <p className="font-medium">{charge.label}</p>
                        {charge.isManual && (
                          <Badge variant="neutral" className="mt-1">
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {charge.dueDate ? new Date(charge.dueDate).toLocaleDateString() : "—"}
                        {overdue && (
                          <Badge variant="danger" className="ml-2">
                            Overdue
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>₹{charge.amount.toLocaleString("en-IN")}</TableCell>
                      <TableCell>{charge.waivedAmount > 0 ? `₹${charge.waivedAmount.toLocaleString("en-IN")}` : "—"}</TableCell>
                      <TableCell>{charge.paidAmount > 0 ? `₹${charge.paidAmount.toLocaleString("en-IN")}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={charge.outstandingAmount > 0 ? (overdue ? "danger" : "warning") : "success"}>
                          ₹{charge.outstandingAmount.toLocaleString("en-IN")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && charge.outstandingAmount > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setAdjusting(charge)}>
                              <HandCoins className="size-4" /> Adjust
                            </Button>
                          )}
                          {canTransfer && charge.outstandingAmount > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setTransferring(charge)}>
                              <ArrowRightLeft className="size-4" /> Transfer
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="sm" onClick={() => setRemoving(charge)}>
                              <Trash2 className="size-4" /> Remove
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {cancelledCharges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cancelled charges</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Cancelled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancelledCharges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell className="text-muted-foreground">{charge.label}</TableCell>
                    <TableCell className="text-muted-foreground">₹{charge.amount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(charge.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {adjustments.length === 0 ? (
            <EmptyState icon={Clock} title="No adjustments yet" className="py-10" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>{new Date(adjustment.appliedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{ADJUSTMENT_LABELS[adjustment.type] ?? adjustment.type}</Badge>
                      {adjustment.relatedStudent && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          to {adjustment.relatedStudent.firstName} {adjustment.relatedStudent.lastName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>₹{adjustment.amount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-muted-foreground">{adjustment.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {addChargeOpen && (
        <AddChargeModal
          studentId={studentId}
          onClose={() => setAddChargeOpen(false)}
          onAdded={() => {
            setAddChargeOpen(false);
            load();
          }}
        />
      )}

      {adjusting && (
        <AdjustmentModal
          charge={adjusting}
          studentId={studentId}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            load();
          }}
        />
      )}

      {transferring && (
        <TransferModal
          charge={transferring}
          studentId={studentId}
          onClose={() => setTransferring(null)}
          onSaved={() => {
            setTransferring(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Remove "${removing?.label ?? "this charge"}"?`}
        description="If it already has a payment or adjustment against it, it will be cancelled instead of deleted so the ledger keeps its history."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={isRemoving}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

/** Mounted only while open, so its fields start fresh without needing an effect to reset them — see the equivalent note on DuplicateModal in fee-structure-detail.tsx. */
function AddChargeModal({ studentId, onClose, onAdded }: { studentId: string; onClose: () => void; onAdded: () => void }) {
  const [mode, setMode] = useState<"item" | "custom">("item");
  const [availableItems, setAvailableItems] = useState<AvailableFeeItemRecord[] | null>(null);
  const [feeCategories, setFeeCategories] = useState<FeeCategoryRecord[]>([]);
  const [feeStructureItemId, setFeeStructureItemId] = useState("");
  const [feeCategoryId, setFeeCategoryId] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentFeeService.availableItems(studentId).then((r) => setAvailableItems(r.data)).catch(() => setAvailableItems([]));
    feeCategoryService.list({ status: "active" }).then((r) => setFeeCategories(r.data)).catch(() => {});
  }, [studentId]);

  async function submit() {
    setError(null);
    if (mode === "item" && !feeStructureItemId) {
      setError("Select a fee item.");
      return;
    }
    if (mode === "custom" && (!feeCategoryId || !label.trim() || !amount)) {
      setError("Fill in the fee category, label and amount.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "item") {
        await studentFeeService.addCharge(studentId, { feeStructureItemId });
      } else {
        await studentFeeService.addCharge(studentId, {
          feeCategoryId,
          label,
          amount: Number(amount),
          dueDate: dueDate || undefined,
          note: note || undefined,
        });
      }
      toast({ title: "Charge added", variant: "success" });
      onAdded();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't add the charge.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Add a charge" size="lg">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <Tabs value={mode} onValueChange={(v) => setMode(v as "item" | "custom")}>
            <TabsList>
              <TabsTrigger value="item">From fee structure</TabsTrigger>
              <TabsTrigger value="custom">Custom charge</TabsTrigger>
            </TabsList>

            <TabsContent value="item">
              {!availableItems ? (
                <LoadingState className="py-6" />
              ) : availableItems.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No optional fee items are available — this student is either already charged for every optional item on
                  their assigned structures, or isn&apos;t assigned to a structure with any.
                </p>
              ) : (
                <FormField label="Fee item" required>
                  {(f) => (
                    <Select value={feeStructureItemId} onValueChange={setFeeStructureItemId}>
                      <SelectTrigger id={f.id}>
                        <SelectValue placeholder="Select a fee item" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.feeCategory.name} — ₹{item.amount.toLocaleString("en-IN")} ({item.feeStructure.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}
            </TabsContent>

            <TabsContent value="custom">
              <div className="flex flex-col gap-4">
                <FormField label="Fee category" required>
                  {(f) => (
                    <Select value={feeCategoryId} onValueChange={setFeeCategoryId}>
                      <SelectTrigger id={f.id}>
                        <SelectValue placeholder="Select fee category" />
                      </SelectTrigger>
                      <SelectContent>
                        {feeCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField label="Label" required>
                  {(f) => <Input {...f} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Late admission fee" />}
                </FormField>
                <FormField label="Amount" required>
                  {(f) => <Input {...f} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
                </FormField>
                <FormField label="Due date">
                  {(f) => <Input {...f} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
                </FormField>
                <FormField label="Note">{(f) => <Textarea {...f} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</FormField>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Add charge
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function AdjustmentModal({
  charge,
  studentId,
  onClose,
  onSaved,
}: {
  charge: StudentFeeChargeRecord;
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"waiver" | "discount" | "correction">("waiver");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount === 0) {
      setError("Enter an amount.");
      return;
    }
    setBusy(true);
    try {
      await studentFeeService.addAdjustment(studentId, { chargeId: charge.id, type, amount: numAmount, reason: reason || undefined });
      toast({ title: "Adjustment applied", variant: "success" });
      onSaved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't apply the adjustment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={`Adjust "${charge.label}"`} description={`Currently payable: ₹${charge.outstandingAmount.toLocaleString("en-IN")}`}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Type">
            {(f) => (
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_FEE_ADJUSTMENT_TYPES.filter((t) => t !== "transfer_out").map((t) => (
                    <SelectItem key={t} value={t}>
                      {ADJUSTMENT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Amount"
            required
            description={type === "correction" ? "Positive increases the amount owed, negative decreases it" : undefined}
          >
            {(f) => <Input {...f} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </FormField>

          <FormField label="Reason">{(f) => <Textarea {...f} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Apply
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function TransferModal({
  charge,
  studentId,
  onClose,
  onSaved,
}: {
  charge: StudentFeeChargeRecord;
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentRecord[]>([]);
  const [target, setTarget] = useState<StudentRecord | null>(null);
  const [amount, setAmount] = useState(String(charge.outstandingAmount));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim() || target) return;
    const timeout = setTimeout(() => {
      studentService
        .list({ q: query, pageSize: 8 })
        .then((r) => setResults(r.data.filter((s) => s.id !== studentId)))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, target, studentId]);
  const visibleResults = target ? [] : results;

  async function submit() {
    setError(null);
    if (!target) {
      setError("Select the receiving student.");
      return;
    }
    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setBusy(true);
    try {
      await studentFeeService.transfer(studentId, { chargeId: charge.id, targetStudentId: target.id, amount: numAmount, reason: reason || undefined });
      toast({ title: "Amount transferred", variant: "success" });
      onSaved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't transfer the amount.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={`Transfer "${charge.label}"`} description={`Currently payable: ₹${charge.outstandingAmount.toLocaleString("en-IN")}`}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Receiving student" required>
            {(f) =>
              target ? (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span>
                    {target.firstName} {target.lastName} · {target.admissionNumber}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTarget(null);
                      setQuery("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input {...f} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or admission number" />
                  {visibleResults.length > 0 && (
                    <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                      {visibleResults.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          className="px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                          onClick={() => {
                            setTarget(s);
                            setResults([]);
                          }}
                        >
                          {s.firstName} {s.lastName} · {s.admissionNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
          </FormField>

          <FormField label="Amount" required>
            {(f) => <Input {...f} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </FormField>

          <FormField label="Reason">{(f) => <Textarea {...f} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy} disabled={!target}>
              Transfer
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
