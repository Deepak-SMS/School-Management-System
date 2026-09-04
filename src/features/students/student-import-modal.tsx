"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, FileDown } from "lucide-react";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
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
 * Import wizard: upload → validate → review errors and preview → confirm.
 *
 * Nothing is written until the administrator confirms, and the server refuses
 * the batch outright if any row is invalid — so an import never lands halfway.
 */
export function StudentImportModal({
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
  const [imported, setImported] = useState(0);
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [academicYearId, setAcademicYearId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    schoolStructureService
      .get()
      .then((s) => {
        setStructure(s);
        // Default to the active year so the common case is one click.
        setAcademicYearId(s.academicYears.find((y) => y.isCurrent)?.id ?? s.academicYears[0]?.id ?? "");
      })
      .catch(() => undefined);
  }, [open]);

  function reset() {
    setStep("upload");
    setResult(null);
    setError(null);
    setImported(0);
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
      const response = await fetch("/api/students/import/validate", { method: "POST", body });
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
      const response = await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYearId, rows: result.validRows }),
      });
      const json = await response.json();
      if (!response.ok) throw json as ApiError;

      setImported(json.created);
      setStep("done");
      toast({ title: `Imported ${json.created} student${json.created === 1 ? "" : "s"}`, variant: "success" });
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't complete the import.");
    } finally {
      setBusy(false);
    }
  }

  /** Lets the administrator take the errors away and fix the source file. */
  function downloadErrors() {
    if (!result) return;
    const csv = toCsv(result.errors, [
      { header: "Row", value: (e) => e.lineNumber },
      { header: "Column", value: (e) => e.column ?? "" },
      { header: "Value", value: (e) => e.rawValue ?? "" },
      { header: "Problem", value: (e) => e.message },
    ]);
    downloadCsv(`student-import-errors-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
        title="Import students"
        description="Upload the filled-in Excel template. Nothing is saved until you confirm."
        size="xl"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {step === "upload" && (
            <>
              <Alert variant="info">
                Use the Excel template so the columns match. Class and section names must already exist in your school.
              </Alert>

              <FormField label="Academic year" required description="Every imported student is enrolled into this year">
                {(f) => (
                  <Select value={academicYearId} onValueChange={setAcademicYearId}>
                    <SelectTrigger id={f.id}>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {(structure?.academicYears ?? []).map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.label}
                          {y.isCurrent ? " (current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField label="Excel file" required description="Up to 5 MB and 2000 rows — .xlsx or .csv">
                {(f) => (
                  <Input
                    {...f}
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  />
                )}
              </FormField>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={validate} isLoading={busy} disabled={!academicYearId}>
                  <Upload className="size-4" /> Validate file
                </Button>
              </div>
            </>
          )}

          {step === "review" && result && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{result.totalRows} rows read</Badge>
                <Badge variant="success">{result.validCount} ready to import</Badge>
                {result.errorCount > 0 && <Badge variant="danger">{result.errorCount} with problems</Badge>}
              </div>

              {result.unknownHeaders.length > 0 && (
                <Alert variant="warning" title="Some columns weren't recognised">
                  These will be ignored: {result.unknownHeaders.join(", ")}.
                </Alert>
              )}

              {result.errorCount > 0 && (
                <Alert variant="danger" title={`${result.errorCount} row${result.errorCount === 1 ? "" : "s"} can't be imported`}>
                  Fix these in your file and upload again. The valid rows below can still be imported now — the
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
                          <TableHead>Name</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Father</TableHead>
                          <TableHead>Mother</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.preview.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.admissionNumber}</TableCell>
                            <TableCell>{[row.firstName, row.lastName].filter(Boolean).join(" ")}</TableCell>
                            <TableCell>{row.className}</TableCell>
                            <TableCell>{row.sectionName || "—"}</TableCell>
                            <TableCell>{row.fatherName || "—"}</TableCell>
                            <TableCell>{row.motherName || "—"}</TableCell>
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
                  Import {result.validCount} student{result.validCount === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="size-10 text-accent-600" aria-hidden="true" />
                <p className="text-lg font-medium text-foreground">
                  Imported {imported} student{imported === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Parents listed in the file were created as guardian records and linked to their children.
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
