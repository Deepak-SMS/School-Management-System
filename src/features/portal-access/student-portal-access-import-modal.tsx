"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { ApiError } from "@/services/studentService";

interface GrantedCredential {
  admissionNumber: string;
  studentName: string;
  email: string;
  temporaryPassword: string;
}

interface RowError {
  lineNumber: number;
  column?: string;
  message: string;
  rawValue?: string;
}

interface ValidateResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  unknownHeaders: string[];
  errors: RowError[];
  errorsTruncated: boolean;
  validRows: { lineNumber: number; values: Record<string, string> }[];
  preview: { admissionNumber: string; email: string; studentName: string }[];
}

type Step = "upload" | "review" | "done";

/**
 * Bulk-grant wizard for student portal logins — same upload → validate →
 * review → confirm shape as StudentImportModal, but the "done" step is
 * different: since temporary passwords are generated server-side and never
 * stored in plaintext, this is the only moment they can be handed to the
 * administrator, so it offers a one-time CSV download instead of just a
 * success count.
 */
export function StudentPortalAccessImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [credentials, setCredentials] = useState<GrantedCredential[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setResult(null);
    setError(null);
    setCredentials([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function validate() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file to import.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/students/import-portal-access/validate", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw json as ApiError;

      setResult(json as ValidateResult);
      setStep("review");
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/students/import-portal-access/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: result.validRows }),
      });
      const json = await response.json();
      if (!response.ok) throw json as ApiError;

      setCredentials(json.credentials as GrantedCredential[]);
      setStep("done");
      toast({ title: `Granted ${json.granted} login${json.granted === 1 ? "" : "s"}`, variant: "success" });
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't complete the import.");
    } finally {
      setBusy(false);
    }
  }

  function downloadErrors() {
    if (!result) return;
    const csv = toCsv(result.errors, [
      { header: "Row", value: (e) => e.lineNumber },
      { header: "Column", value: (e) => e.column ?? "" },
      { header: "Value", value: (e) => e.rawValue ?? "" },
      { header: "Problem", value: (e) => e.message },
    ]);
    downloadCsv(`student-portal-access-errors-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  function downloadCredentials() {
    const csv = toCsv(credentials, [
      { header: "Admission Number", value: (c) => c.admissionNumber },
      { header: "Student Name", value: (c) => c.studentName },
      { header: "Login Email", value: (c) => c.email },
      { header: "Temporary Password", value: (c) => c.temporaryPassword },
    ]);
    downloadCsv(`student-portal-credentials-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <ModalContent
        title="Bulk grant student portal access"
        description="Upload a CSV mapping admission numbers to login emails. Nothing is saved until you confirm."
        size="xl"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {step === "upload" && (
            <>
              <Alert variant="info">
                Each row grants (or updates) the login for the student with that admission number. Leave
                &quot;Temporary Password&quot; blank to have one generated automatically.
              </Alert>

              <FormField label="CSV file" required description="Up to 5 MB and 2000 rows">
                {(f) => <Input {...f} ref={fileRef} type="file" accept=".csv,text/csv" />}
              </FormField>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={validate} isLoading={busy}>
                  <Upload className="size-4" /> Validate file
                </Button>
              </div>
            </>
          )}

          {step === "review" && result && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{result.totalRows} rows read</Badge>
                <Badge variant="success">{result.validCount} ready to grant</Badge>
                {result.errorCount > 0 && <Badge variant="danger">{result.errorCount} with problems</Badge>}
              </div>

              {result.unknownHeaders.length > 0 && (
                <Alert variant="warning" title="Some columns weren't recognised">
                  These will be ignored: {result.unknownHeaders.join(", ")}.
                </Alert>
              )}

              {result.errorCount > 0 && (
                <Alert variant="danger" title={`${result.errorCount} row${result.errorCount === 1 ? "" : "s"} can't be granted`}>
                  Fix these in your file and upload again. The valid rows below can still be granted now — the
                  problem rows will simply be left out.
                </Alert>
              )}

              {result.errors.length > 0 && (
                <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-md border border-border p-3">
                  {result.errors.map((e, i) => (
                    <p key={`${e.lineNumber}-${i}`} className="text-sm">
                      <span className="font-medium text-danger-600">Row {e.lineNumber}</span>
                      {e.column && <span className="text-muted-foreground"> · {e.column}</span>}
                      <span className="text-foreground"> — {e.message}</span>
                    </p>
                  ))}
                  {result.errorsTruncated && (
                    <p className="text-xs text-muted-foreground">Only the first 200 problems are listed.</p>
                  )}
                </div>
              )}

              {result.validCount > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Preview — first {Math.min(10, result.validCount)} of {result.validCount}
                  </p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admission no.</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Login email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.preview.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.admissionNumber}</TableCell>
                            <TableCell>{row.studentName}</TableCell>
                            <TableCell>{row.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {result.errors.length > 0 && (
                  <Button variant="secondary" onClick={downloadErrors}>
                    <FileDown className="size-4" /> Download error report
                  </Button>
                )}
                <Button variant="secondary" onClick={reset} disabled={busy}>
                  Choose another file
                </Button>
                <Button onClick={commit} isLoading={busy} disabled={result.validCount === 0}>
                  Grant {result.validCount} login{result.validCount === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="size-10 text-accent-600" aria-hidden="true" />
                <p className="text-lg font-medium text-foreground">
                  Granted {credentials.length} login{credentials.length === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Passwords aren&apos;t stored anywhere — download them now to hand out. Each account must change its
                  password on first sign-in.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={downloadCredentials}>
                  <FileDown className="size-4" /> Download credentials
                </Button>
                <Button
                  onClick={() => {
                    reset();
                    onImported();
                  }}
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
