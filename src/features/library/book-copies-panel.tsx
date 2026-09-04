"use client";

import { useState } from "react";
import { Plus, Trash2, Barcode } from "lucide-react";
import { libraryBookCopyService } from "@/services/libraryService";
import type { LibraryBookCopyRecord, LibraryBookRecord } from "@/types/library";
import {
  LIBRARY_COPY_CONDITIONS,
  LIBRARY_COPY_CONDITION_LABELS,
  LIBRARY_COPY_STATUSES,
  LIBRARY_COPY_STATUS_LABELS,
  type LibraryCopyCondition,
  type LibraryCopyStatus,
} from "@/lib/constants/library";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const STATUS_BADGE: Record<string, "success" | "primary" | "warning" | "danger" | "neutral"> = {
  available: "success",
  issued: "primary",
  reserved: "warning",
  lost: "danger",
  damaged: "danger",
  under_maintenance: "warning",
  removed: "neutral",
};

export function BookCopiesPanel({
  book,
  copies,
  onChanged,
}: {
  book: LibraryBookRecord;
  copies: LibraryBookCopyRecord[];
  onChanged: () => void;
}) {
  const can = useCan();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<LibraryBookCopyRecord | null>(null);

  async function updateCopy(id: string, patch: { status?: LibraryCopyStatus; condition?: LibraryCopyCondition }) {
    try {
      await libraryBookCopyService.update(id, patch);
      onChanged();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the copy.", variant: "danger" });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await libraryBookCopyService.remove(deleting.id);
      toast({ title: "Copy removed", variant: "success" });
      setDeleting(null);
      onChanged();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the copy.", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {copies.length} cop{copies.length === 1 ? "y" : "ies"}
        </p>
        {can("libraryCatalogue", "create") && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add copies
          </Button>
        )}
      </div>

      {copies.length === 0 ? (
        <EmptyState
          icon={Barcode}
          title="No physical copies yet"
          description="Add one or more copies to generate accession numbers and barcodes for this title."
          action={
            can("libraryCatalogue", "create") ? (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Add copies
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Accession No.</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {copies.map((copy) => (
              <TableRow key={copy.id}>
                <TableCell className="font-mono text-sm">{copy.accessionNumber}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{copy.barcode}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[copy.shelf, copy.rack, copy.rowLabel].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  {can("libraryCatalogue", "edit") ? (
                    <Select value={copy.status} onValueChange={(v) => updateCopy(copy.id, { status: v as LibraryCopyStatus })}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIBRARY_COPY_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {LIBRARY_COPY_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={STATUS_BADGE[copy.status] ?? "neutral"}>{LIBRARY_COPY_STATUS_LABELS[copy.status as keyof typeof LIBRARY_COPY_STATUS_LABELS] ?? copy.status}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {can("libraryCatalogue", "edit") ? (
                    <Select value={copy.condition} onValueChange={(v) => updateCopy(copy.id, { condition: v as LibraryCopyCondition })}>
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIBRARY_COPY_CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {LIBRARY_COPY_CONDITION_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    LIBRARY_COPY_CONDITION_LABELS[copy.condition as keyof typeof LIBRARY_COPY_CONDITION_LABELS] ?? copy.condition
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {can("libraryCatalogue", "delete") && copy.status === "available" && (
                    <Button variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-50 hover:text-danger-600" onClick={() => setDeleting(copy)}>
                      <Trash2 className="size-4" /> Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddCopiesModal
        open={adding}
        book={book}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          onChanged();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove copy ${deleting?.accessionNumber ?? ""}?`}
        description="This permanently deletes the accession number and barcode. Only available copies can be removed."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function AddCopiesModal({
  open,
  book,
  onClose,
  onSaved,
}: {
  open: boolean;
  book: LibraryBookRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("good");
  const [shelf, setShelf] = useState(book.shelf ?? "");
  const [rack, setRack] = useState(book.rack ?? "");
  const [rowLabel, setRowLabel] = useState(book.rowLabel ?? "");
  const [price, setPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await libraryBookCopyService.create(book.id, {
        quantity: Number(quantity) || 1,
        condition: condition as (typeof LIBRARY_COPY_CONDITIONS)[number],
        shelf: shelf || undefined,
        rack: rack || undefined,
        rowLabel: rowLabel || undefined,
        price: price ? Number(price) : undefined,
        purchaseDate: purchaseDate || undefined,
      });
      toast({ title: `${result.total} cop${result.total === 1 ? "y" : "ies"} added`, variant: "success" });
      onSaved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't add copies.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={`Add copies of ${book.title}`}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="text-xs text-muted-foreground">
            Accession numbers and barcodes are generated automatically — one per copy.
          </p>

          <FormField label="Quantity" required>
            {(f) => <Input {...f} type="number" min={1} max={200} value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
          </FormField>

          <FormField label="Condition">
            {(f) => (
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIBRARY_COPY_CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {LIBRARY_COPY_CONDITION_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Shelf">{(f) => <Input {...f} value={shelf} onChange={(e) => setShelf(e.target.value)} />}</FormField>
            <FormField label="Rack">{(f) => <Input {...f} value={rack} onChange={(e) => setRack(e.target.value)} />}</FormField>
            <FormField label="Row">{(f) => <Input {...f} value={rowLabel} onChange={(e) => setRowLabel(e.target.value)} />}</FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Purchase date">
              {(f) => <Input {...f} type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />}
            </FormField>
            <FormField label="Price (₹, per copy)">
              {(f) => <Input {...f} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />}
            </FormField>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Add {quantity || "1"} cop{Number(quantity) === 1 ? "y" : "ies"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
