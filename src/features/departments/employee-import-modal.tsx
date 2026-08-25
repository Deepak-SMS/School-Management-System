"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, FileDown } from "lucide-react";
import { departmentService } from "@/services/departmentService";
import type { DepartmentRecord } from "@/types/department";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { ApiError } from "@/services/studentService";

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
  preview: Record<string, string>[];
}

type Step = "upload" | "review" | "done";

/**
 * Employee import wizard: upload → validate → review → confirm.
 *
 * Mirrors the student importer deliberately — same shape, same guarantees:
 * nothing is written until confirmed, and the server refuses the batch outright
 * if any row is invalid rather than importing half of it.
 */
export function EmployeeImportModal({
  open,
  onClose,
  onImported,
  fixedDepartmentId,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  /** Set when importing from inside a department — every row lands there. */
  fixedDepartmentId?: string;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [imported, setImported] = useState(0);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [departmentId, setDepartmentId] = useState(fixedDepartmentId ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || fixedDepartmentId) return;
    departmentService
      .list({ pageSize: 200, status: "active" })
      .then((r) => setDepartments(r.data))
      .catch(() => undefined);
  }, [open, fixedDepartmentId]);

  function reset() {
    setStep("upload");
    setResult(null);
    setError(null);
    setImported(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function downloadTemplate() {
    try {
      const response = await fetch("/api/staff/import/template");
      if (!response.ok) throw new Error("Couldn't download the template.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "employee-import-template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Template downloaded", variant: "success" });
    } catch (e) {
      toast({ title: (e as Error).message, variant: "danger" });
    }
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
      const response = await fetch("/api/staff/import/validate", { method: "POST", body });
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
      const response = await fetch("/api/staff/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: departmentId || undefined, rows: result.validRows }),
      });
      const json = await response.json();
      if (!response.ok) throw json as ApiError;
      setImported(json.created);
      setStep("done");
      toast({ title: `Imported ${json.created} employee${json.created === 1 ? "" : "s"}`, variant: "success" });
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
    downloadCsv(`employee-import-errors-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
        title="Import employees"
        description="Upload the filled-in CSV template. Nothing is saved until you confirm."
        size="xl"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {step === "upload" && (
            <>
              <Alert variant="info">
                Department, employee type and campus are matched by name and must already exist. Designations are
                created automatically. Bank and PAN details aren&apos;t imported — add those on each profile.
              </Alert>

              {!fixedDepartmentId && (
                <FormField
                  label="Put everyone in this department"
                  description="Optional — leave blank to use the Department column in the file"
                >
                  {(f) => (
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger id={f.id}>
                        <SelectValue placeholder="Use the file's Department column" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}

              <FormField label="CSV file" required description="Up to 5 MB and 2000 rows">
                {(f) => <Input {...f} ref={fileRef} type="file" accept=".csv,text/csv" />}
              </FormField>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={downloadTemplate}>
                  <FileDown className="size-4" /> Download template
                </Button>
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
                <Badge variant="success">{result.validCount} ready</Badge>
                {result.errorCount > 0 && <Badge variant="danger">{result.errorCount} with problems</Badge>}
              </div>

              {result.unknownHeaders.length > 0 && (
                <Alert variant="warning" title="Some columns weren't recognised">
                  These will be ignored: {result.unknownHeaders.join(", ")}.
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
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Mobile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.preview.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{[row.firstName, row.lastName].filter(Boolean).join(" ")}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell>{row.departmentName || "—"}</TableCell>
                          <TableCell>{row.designationName || "—"}</TableCell>
                          <TableCell>{row.mobileNumber}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                  Import {result.validCount} employee{result.validCount === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="size-10 text-accent-600" aria-hidden="true" />
                <p className="text-lg font-medium text-foreground">
                  Imported {imported} employee{imported === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Each has an employee ID and a verification identifier, and appears in their department.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={reset}>
                  Import another file
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
