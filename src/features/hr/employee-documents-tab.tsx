"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload, ShieldCheck, ShieldX, Download } from "lucide-react";
import { employeeService, uploadService } from "@/services/hrService";
import type { EmployeeDocument } from "@/types/hr";
import { STAFF_DOCUMENT_TYPES, STAFF_DOCUMENT_TYPE_LABELS, type StaffDocumentType } from "@/lib/constants/hr";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

/** Days before expiry at which a document is flagged as expiring soon. */
const EXPIRY_WARNING_DAYS = 30;

export function EmployeeDocumentsTab({ staffId, onChanged }: { staffId: string; onChanged?: () => void }) {
  const can = useCan();
  const [docs, setDocs] = useState<EmployeeDocument[] | null>(null);
  const [error, setError] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(() => {
    setError(false);
    employeeService
      .documents(staffId)
      .then((r) => setDocs(r.data))
      .catch(() => setError(true));
  }, [staffId]);

  useEffect(load, [load]);

  async function review(doc: EmployeeDocument, status: "verified" | "rejected") {
    let rejectionNote: string | undefined;
    if (status === "rejected") {
      const note = window.prompt("Why is this document being rejected?");
      if (!note) return;
      rejectionNote = note;
    }
    try {
      await employeeService.reviewDocument(staffId, doc.id, { status, rejectionNote });
      toast({ title: `Document ${status}`, variant: "success" });
      load();
      onChanged?.();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the document", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load documents." onRetry={load} />;
  if (!docs) return <TableSkeleton rows={4} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {docs.length} document{docs.length === 1 ? "" : "s"} on file
        </p>
        {can("employeeDocuments", "create") && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" /> Upload document
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents uploaded"
          description="Identity proofs, certificates and letters filed for this employee will appear here."
          action={
            can("employeeDocuments", "create") ? (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" /> Upload document
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {STAFF_DOCUMENT_TYPE_LABELS[doc.documentType as StaffDocumentType] ?? doc.documentType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {doc.title || doc.uploadedFile?.originalName || "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge doc={doc} />
                  {doc.status === "rejected" && doc.rejectionNote && (
                    <p className="mt-1 text-xs text-muted-foreground">{doc.rejectionNote}</p>
                  )}
                </TableCell>
                <TableCell>
                  <ExpiryCell expiryDate={doc.expiryDate} />
                </TableCell>
                <TableCell className="text-muted-foreground">v{doc.version}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="sm">
                      {/* Streams through the authorization-checked file route, never a public path. */}
                      <a href={`/api/files/${doc.uploadedFileId}`} target="_blank" rel="noopener noreferrer">
                        <Download className="size-4" /> Open
                      </a>
                    </Button>
                    {can("employeeDocuments", "verify") && doc.status !== "verified" && (
                      <Button variant="ghost" size="sm" onClick={() => review(doc, "verified")}>
                        <ShieldCheck className="size-4" /> Verify
                      </Button>
                    )}
                    {can("employeeDocuments", "verify") && doc.status !== "rejected" && (
                      <Button variant="ghost" size="sm" onClick={() => review(doc, "rejected")}>
                        <ShieldX className="size-4" /> Reject
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UploadDocumentModal
        staffId={staffId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          load();
          onChanged?.();
        }}
      />
    </div>
  );
}

function StatusBadge({ doc }: { doc: EmployeeDocument }) {
  if (isExpired(doc.expiryDate)) return <Badge variant="danger">Expired</Badge>;
  if (doc.status === "verified") return <Badge variant="success">Verified</Badge>;
  if (doc.status === "rejected") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="warning">Pending verification</Badge>;
}

function ExpiryCell({ expiryDate }: { expiryDate?: string | null }) {
  if (!expiryDate) return <span className="text-muted-foreground">—</span>;
  const days = daysUntil(expiryDate);
  const formatted = new Date(expiryDate).toLocaleDateString(undefined, { dateStyle: "medium" });

  if (days < 0) return <span className="font-medium text-danger-600">{formatted} · expired</span>;
  if (days <= EXPIRY_WARNING_DAYS) {
    return (
      <span className="font-medium text-warning-600">
        {formatted} · {days}d left
      </span>
    );
  }
  return <span>{formatted}</span>;
}

function UploadDocumentModal({
  staffId,
  open,
  onClose,
  onUploaded,
}: {
  staffId: string;
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [documentType, setDocumentType] = useState<string>("aadhaar");
  const [title, setTitle] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Two steps by design: the file is stored first and only then linked, so a
      // failed link never leaves a half-created document row.
      const uploaded = await uploadService.upload(file, "staff_document");
      await employeeService.addDocument(staffId, {
        documentType,
        title: title || undefined,
        uploadedFileId: uploaded.id,
        expiryDate: expiryDate || undefined,
      });
      toast({ title: "Document uploaded", variant: "success" });
      setTitle("");
      setExpiryDate("");
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't upload the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Upload document" description="Files are stored privately and served only through an access-checked route.">
        <div className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <FormField label="Document type" required>
          {(field) => (
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id={field.id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {STAFF_DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>

        <FormField label="Title" description="Optional label to tell similar documents apart">
          {(field) => <Input {...field} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </FormField>

        <FormField label="Expiry date" description="Used to warn before the document lapses">
          {(field) => (
            <Input {...field} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          )}
        </FormField>

        <FormField label="File" required description="PDF or image, up to 15 MB">
          {(field) => <Input {...field} ref={fileRef} type="file" accept="image/*,application/pdf" />}
        </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Upload
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function daysUntil(date: string): number {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isExpired(date?: string | null): boolean {
  return Boolean(date) && daysUntil(date as string) < 0;
}
