"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Copy, Rocket, Archive as ArchiveIcon, Trash2 } from "lucide-react";
import { feeStructureService } from "@/services/feeStructureService";
import { academicYearService } from "@/services/academicYearService";
import type { FeeStructureRecord } from "@/types/fees";
import type { AcademicYearRecord } from "@/types/academicYear";
import { FEE_FREQUENCY_LABELS, FEE_STRUCTURE_STATUS_LABELS } from "@/lib/constants/fees";
import { useCan } from "@/hooks/use-can";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

export function FeeStructureDetail({ id }: { id: string }) {
  const can = useCan();
  const router = useRouter();
  const [structure, setStructure] = useState<FeeStructureRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishPreview, setPublishPreview] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [duplicateOpen, setDuplicateOpen] = useState(false);

  function load() {
    feeStructureService
      .get(id)
      .then((s) => {
        setStructure(s);
        setError(null);
      })
      .catch(() => setError("Couldn't load this fee structure."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!structure) return <LoadingState />;

  async function openPublish() {
    setPublishOpen(true);
    setPublishPreview(null);
    try {
      const preview = await feeStructureService.previewEligibleStudents(structure!.id);
      setPublishPreview(preview.count);
    } catch {
      setPublishPreview(0);
    }
  }

  async function confirmPublish() {
    setPublishing(true);
    try {
      const result = await feeStructureService.publish(structure!.id);
      toast({
        title: "Fee structure published",
        description: `${result.newlyAssigned} newly assigned (${result.chargesGenerated} charges created), ${result.totalAssigned} student${result.totalAssigned === 1 ? "" : "s"} total.`,
        variant: "success",
      });
      setPublishOpen(false);
      setStructure(result.structure);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't publish the fee structure.", variant: "danger" });
    } finally {
      setPublishing(false);
    }
  }

  async function confirmArchive() {
    setArchiving(true);
    try {
      const updated = await feeStructureService.archive(structure!.id);
      toast({ title: "Fee structure archived", variant: "success" });
      setArchiveConfirm(false);
      setStructure(updated);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't archive the fee structure.", variant: "danger" });
    } finally {
      setArchiving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await feeStructureService.remove(structure!.id);
      toast({ title: "Fee structure deleted", variant: "success" });
      router.push("/fees/structure");
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the fee structure.", variant: "danger" });
      setDeleting(false);
    }
  }

  const canEdit = can("feeStructures", "edit");
  const canPublish = can("feeStructures", "activate");
  const canArchive = can("feeStructures", "deactivate");
  const canDelete = can("feeStructures", "delete");
  const canCreate = can("feeStructures", "create");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{structure.name}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[structure.status] ?? "neutral"}>
              {(FEE_STRUCTURE_STATUS_LABELS as Record<string, string>)[structure.status] ?? structure.status}
            </Badge>
          </div>
          {structure.description && <p className="mt-1 text-sm text-muted-foreground">{structure.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild variant="secondary">
              <Link href={`/fees/structure/${structure.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button variant="secondary" onClick={() => setDuplicateOpen(true)}>
              <Copy className="size-4" /> Duplicate
            </Button>
          )}
          {canPublish && structure.status !== "archived" && (
            <Button onClick={openPublish}>
              <Rocket className="size-4" /> {structure.status === "published" ? "Refresh assignments" : "Publish"}
            </Button>
          )}
          {canArchive && structure.status === "published" && (
            <Button variant="secondary" onClick={() => setArchiveConfirm(true)}>
              <ArchiveIcon className="size-4" /> Archive
            </Button>
          )}
          {canDelete && structure.status === "draft" && (
            <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryStat label="Academic year" value={"label" in structure.academicYear ? structure.academicYear.label : "—"} />
        <SummaryStat
          label="Applies to"
          value={[structure.class?.name, structure.section?.name, structure.studentCategory?.name].filter(Boolean).join(" · ") || "Everyone"}
        />
        <SummaryStat label="Total per student" value={`₹${structure.totalAmount.toLocaleString("en-IN")}`} />
        <SummaryStat label="Assigned students" value={String(structure.counts?.assignedStudents ?? 0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Optional</TableHead>
                <TableHead>Late fee rule</TableHead>
                <TableHead>Installments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structure.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.feeCategory.name}</TableCell>
                  <TableCell>₹{item.amount.toLocaleString("en-IN")}</TableCell>
                  <TableCell>{(FEE_FREQUENCY_LABELS as Record<string, string>)[item.frequency] ?? item.frequency}</TableCell>
                  <TableCell>{item.isOptional ? <Badge variant="warning">Optional</Badge> : "—"}</TableCell>
                  <TableCell>{item.lateFeeRule?.name ?? "—"}</TableCell>
                  <TableCell>
                    {item.installments.length === 0 ? (
                      <span className="text-muted-foreground">Billed in full</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {item.installments.map((installment) => (
                          <li key={installment.id} className="text-xs text-muted-foreground">
                            {installment.label} — ₹{installment.amount.toLocaleString("en-IN")} due{" "}
                            {new Date(installment.dueDate).toLocaleDateString()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={structure.status === "published" ? "Refresh student assignments?" : "Publish this fee structure?"}
        description={
          publishPreview === null
            ? "Checking how many students this applies to..."
            : `This applies to ${publishPreview} student${publishPreview === 1 ? "" : "s"} right now. ${
                structure.status === "published"
                  ? "Any newly-matching students will be assigned; existing assignments are kept."
                  : "They'll be assigned to this structure once published."
              }`
        }
        confirmLabel={structure.status === "published" ? "Refresh" : "Publish"}
        isLoading={publishing || publishPreview === null}
        onConfirm={confirmPublish}
      />

      <ConfirmDialog
        open={archiveConfirm}
        onOpenChange={setArchiveConfirm}
        title="Archive this fee structure?"
        description="It stops being editable and won't accept new assignments, but existing student assignments and reporting stay intact."
        confirmLabel="Archive"
        isLoading={archiving}
        onConfirm={confirmArchive}
      />

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="Delete this fee structure?"
        description="This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleting}
        onConfirm={confirmDelete}
      />

      {duplicateOpen && (
        <DuplicateModal
          structure={structure}
          onClose={() => setDuplicateOpen(false)}
          onDuplicated={(created) => {
            setDuplicateOpen(false);
            router.push(`/fees/structure/${created.id}/edit`);
          }}
        />
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/** Mounted only while the dialog is open (see the `duplicateOpen &&` guard above), so every field below starts fresh from `structure` without needing an effect to reset it. */
function DuplicateModal({
  structure,
  onClose,
  onDuplicated,
}: {
  structure: FeeStructureRecord;
  onClose: () => void;
  onDuplicated: (created: FeeStructureRecord) => void;
}) {
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [academicYearId, setAcademicYearId] = useState(structure.academicYearId);
  const [name, setName] = useState(`${structure.name} (Copy)`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => setAcademicYears(r.data)).catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await feeStructureService.duplicate(structure.id, { academicYearId, name: name || undefined });
      toast({ title: "Fee structure duplicated", variant: "success" });
      onDuplicated(created);
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't duplicate the fee structure.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title="Duplicate fee structure"
        description="Creates a new draft with the same fee items — review and publish it separately."
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name">{(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}</FormField>

          <FormField label="Academic year" required>
            {(field) => (
              <Select value={academicYearId} onValueChange={setAcademicYearId}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy} disabled={!academicYearId}>
              Duplicate
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
