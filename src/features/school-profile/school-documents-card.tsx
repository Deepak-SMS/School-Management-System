"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, ShieldCheck, ShieldX, Download, Trash2, AlertTriangle } from "lucide-react";
import {
  SCHOOL_DOCUMENT_TYPES,
  SCHOOL_DOCUMENT_LABELS,
  SCHOOL_DOCUMENT_EXPIRY_WARNING_DAYS,
} from "@/lib/constants/school-documents";
import { uploadService } from "@/services/hrService";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

interface SchoolDocument {
  id: string;
  documentType: string;
  title?: string | null;
  referenceValue?: string | null;
  status: string;
  version: number;
  issuedOn?: string | null;
  expiresOn?: string | null;
  note?: string | null;
  createdAt: string;
  uploadedFile?: { id: string; originalName?: string | null; sizeBytes?: number | null };
}

/**
 * The registration numbers already captured on the profile, used to prefill the
 * upload form and to spot a number with no certificate behind it. Keys match
 * `field` on SCHOOL_DOCUMENT_TYPES.
 */
export interface SchoolRegistrationNumbers {
  udisePlusCode?: string | null;
  udiseSchoolId?: string | null;
  recognitionNumber?: string | null;
  boardAffiliationNumber?: string | null;
  schoolCode?: string | null;
  rteRegistrationNumber?: string | null;
  nocNumber?: string | null;
}

type ProfileValues = SchoolRegistrationNumbers;

/** Narrow lookup so a `field` string can index the profile without casting it wide. */
function numberFor(profile: ProfileValues, field: string | null): string | null | undefined {
  if (!field) return null;
  return (profile as Record<string, string | null | undefined>)[field];
}

/**
 * The certificates behind the school's registration numbers.
 *
 * Each row pairs a document type with the number it evidences, so a number
 * recorded with no certificate on file is visible rather than assumed fine —
 * that gap is what an inspection finds.
 */
export function SchoolDocumentsCard({ profile }: { profile: ProfileValues }) {
  const can = useCan();
  const canEdit = can("schoolProfile", "edit");

  const [documents, setDocuments] = useState<SchoolDocument[] | null>(null);
  const [error, setError] = useState(false);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SchoolDocument | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/school/documents")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setDocuments(body.data);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function review(doc: SchoolDocument, status: "verified" | "rejected") {
    let note: string | undefined;
    if (status === "rejected") {
      const reason = window.prompt("Why is this document being rejected?");
      if (!reason) return;
      note = reason;
    }
    try {
      const response = await fetch(`/api/school/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: `Document ${status}`, variant: "success" });
      reload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the document", variant: "danger" });
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      const response = await fetch(`/api/school/documents/${deleting.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: "Document removed", variant: "success" });
      setDeleting(null);
      reload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the document", variant: "danger" });
      setDeleting(null);
    }
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registration documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState description="Couldn't load school documents." onRetry={reload} />
        </CardContent>
      </Card>
    );
  }

  // Only the newest version of each type is shown; older ones stay as history.
  const latestByType = new Map<string, SchoolDocument>();
  for (const doc of documents ?? []) {
    const current = latestByType.get(doc.documentType);
    if (!current || doc.version > current.version) latestByType.set(doc.documentType, doc);
  }

  const missingCount = SCHOOL_DOCUMENT_TYPES.filter(
    (t) => numberFor(profile, t.field) && !latestByType.has(t.value),
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Registration documents</CardTitle>
          <CardDescription>
            The certificate behind each registration number. Stored privately and opened through an access-checked
            link.
          </CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setUploadFor("udise_plus_code")}>
            <Upload className="size-4" /> Upload document
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {!documents && <LoadingState />}

        {documents && missingCount > 0 && (
          <Alert variant="warning" title={`${missingCount} number${missingCount === 1 ? " has" : "s have"} no document on file`}>
            These are recorded on the profile but nothing evidences them yet.
          </Alert>
        )}

        {documents && (
          <ul className="flex flex-col divide-y divide-border">
            {SCHOOL_DOCUMENT_TYPES.map((type) => {
              const doc = latestByType.get(type.value);
              const numberOnFile = numberFor(profile, type.field);

              // "Other" only appears once something has been filed under it.
              if (type.value === "other" && !doc) return null;

              return (
                <li key={type.value} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{type.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {numberOnFile ? <span className="font-mono">{numberOnFile}</span> : "No number recorded"}
                      {doc?.uploadedFile?.originalName ? ` · ${doc.uploadedFile.originalName}` : ""}
                      {doc ? ` · v${doc.version}` : ""}
                    </p>
                    {doc?.note && <p className="mt-0.5 text-xs text-muted-foreground">{doc.note}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge doc={doc} hasNumber={Boolean(numberOnFile)} />

                    {doc && (
                      <Button asChild variant="ghost" size="sm">
                        <a
                          href={`/api/files/${doc.uploadedFile?.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="size-4" /> Open
                        </a>
                      </Button>
                    )}

                    {canEdit && doc && doc.status !== "verified" && (
                      <Button variant="ghost" size="sm" onClick={() => review(doc, "verified")}>
                        <ShieldCheck className="size-4" /> Verify
                      </Button>
                    )}
                    {canEdit && doc && doc.status !== "rejected" && (
                      <Button variant="ghost" size="sm" onClick={() => review(doc, "rejected")}>
                        <ShieldX className="size-4" /> Reject
                      </Button>
                    )}
                    {canEdit && doc && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(doc)}>
                        <Trash2 className="size-4" />
                        <span className="sr-only">Remove {type.label}</span>
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="secondary" size="sm" onClick={() => setUploadFor(type.value)}>
                        <Upload className="size-4" /> {doc ? "Replace" : "Upload"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {documents?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing uploaded yet. Use <strong>Upload</strong> beside a number to file its certificate.
          </p>
        )}
      </CardContent>

      {uploadFor && (
        <UploadDocumentModal
          documentType={uploadFor}
          defaultReference={
            numberFor(profile, SCHOOL_DOCUMENT_TYPES.find((t) => t.value === uploadFor)?.field ?? null) ?? ""
          }
          onClose={() => setUploadFor(null)}
          onUploaded={() => {
            setUploadFor(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove ${SCHOOL_DOCUMENT_LABELS[deleting?.documentType ?? ""] ?? "document"}?`}
        description="The record is removed from this list. Earlier versions, if any, remain."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={remove}
      />
    </Card>
  );
}

function StatusBadge({ doc, hasNumber }: { doc?: SchoolDocument; hasNumber: boolean }) {
  if (!doc) {
    // A number with no certificate is the gap worth flagging; no number at all
    // is simply not applicable yet.
    return hasNumber ? <Badge variant="warning">No document</Badge> : <Badge variant="neutral">Not recorded</Badge>;
  }

  const days = doc.expiresOn ? daysUntil(doc.expiresOn) : null;
  if (days !== null && days < 0) return <Badge variant="danger">Expired</Badge>;
  if (days !== null && days <= SCHOOL_DOCUMENT_EXPIRY_WARNING_DAYS) {
    return (
      <Badge variant="warning">
        <AlertTriangle className="size-3" aria-hidden="true" /> {days}d left
      </Badge>
    );
  }
  if (doc.status === "verified") return <Badge variant="success">Verified</Badge>;
  if (doc.status === "rejected") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

function UploadDocumentModal({
  documentType,
  defaultReference,
  onClose,
  onUploaded,
}: {
  documentType: string;
  defaultReference: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [type, setType] = useState(documentType);
  const [reference, setReference] = useState(defaultReference);
  const [title, setTitle] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
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
      // Stored first, then linked — a failed link never leaves a half-created
      // document row.
      const uploaded = await uploadService.upload(file, "school_document");
      const response = await fetch("/api/school/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: type,
          title: title || undefined,
          referenceValue: reference || undefined,
          uploadedFileId: uploaded.id,
          issuedOn: issuedOn || undefined,
          expiresOn: expiresOn || undefined,
          note: note || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      toast({ title: "Document uploaded", variant: "success" });
      onUploaded();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't upload the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Upload registration document" description="PDF or image, up to 20 MB.">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Document" required>
            {(f) => (
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Number on the document"
            description="Kept with the file, so it still makes sense if the profile is corrected later"
          >
            {(f) => <Input {...f} value={reference} onChange={(e) => setReference(e.target.value)} />}
          </FormField>

          <FormField label="Title" description="Optional — e.g. 'CBSE affiliation letter 2026'">
            {(f) => <Input {...f} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Issued on">
              {(f) => <Input {...f} type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />}
            </FormField>
            <FormField label="Valid until" description="Used to warn before it lapses">
              {(f) => <Input {...f} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />}
            </FormField>
          </div>

          <FormField label="Note">
            {(f) => <Textarea {...f} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
          </FormField>

          <FormField label="File" required description="PDF, JPG, PNG or WebP">
            {(f) => <Input {...f} ref={fileRef} type="file" accept="image/*,application/pdf" />}
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
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
