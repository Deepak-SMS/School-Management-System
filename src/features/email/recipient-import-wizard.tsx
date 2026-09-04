"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { toCsv, downloadCsv } from "@/lib/csv";
import { emailRecipientImportService } from "@/services/emailRecipientImportService";
import type { InspectedRecipientWorkbook, RecipientImportValidateResult, RecipientImportValidRow } from "@/lib/email-campaigns/recipient-import";

type Step = "upload" | "mapping" | "review";

interface RecipientImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands the validated rows back to the campaign wizard — nothing is persisted here; they only become EmailJob rows once this campaign is created. */
  onImported: (rows: RecipientImportValidRow[]) => void;
}

/**
 * Unlike src/features/whatsapp/contact-import-wizard.tsx, this never writes a
 * contact/student record — spec §14 treats an imported list as
 * campaign-specific data. So there's no "commit" step; Review is the last
 * step and just returns the valid rows to the wizard that opened this.
 */
export function RecipientImportWizard({ open, onOpenChange, onImported }: RecipientImportWizardProps) {
  const [step, setStep] = useState<Step>("upload");
  const [inspected, setInspected] = useState<InspectedRecipientWorkbook | null>(null);
  const [nameColumn, setNameColumn] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [result, setResult] = useState<RecipientImportValidateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function reset() {
    setStep("upload");
    setInspected(null);
    setNameColumn("");
    setEmailColumn("");
    setCustomColumns([]);
    setResult(null);
    fileRef.current = null;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;
    setBusy(true);
    try {
      const inspectResult = await emailRecipientImportService.inspect(file);
      setInspected(inspectResult);
      setNameColumn(inspectResult.headers.find((h) => /name/i.test(h)) ?? inspectResult.headers[0] ?? "");
      setEmailColumn(inspectResult.headers.find((h) => /e-?mail/i.test(h)) ?? "");
      setStep("mapping");
    } catch (err) {
      toast({ title: "Couldn't read that file", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleValidate() {
    if (!fileRef.current || !nameColumn || !emailColumn) return;
    setBusy(true);
    try {
      const validateResult = await emailRecipientImportService.validate(fileRef.current, { nameColumn, emailColumn, customColumns });
      setResult(validateResult);
      setStep("review");
    } catch (err) {
      toast({ title: "Validation failed", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  function handleUse() {
    if (!result) return;
    onImported(result.validRows);
    onOpenChange(false);
  }

  function downloadErrors() {
    if (!result) return;
    const csv = toCsv(result.errors, [
      { header: "Row", value: (r) => r.lineNumber },
      { header: "Column", value: (r) => r.column ?? "" },
      { header: "Message", value: (r) => r.message },
      { header: "Value", value: (r) => r.rawValue ?? "" },
    ]);
    downloadCsv("email-recipient-import-errors.csv", csv);
  }

  const otherColumns = (inspected?.headers ?? []).filter((h) => h !== nameColumn && h !== emailColumn);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <ModalContent title="Import Recipients from Excel" size="lg">
        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-center text-sm text-muted-foreground">Upload a .xlsx, .xls, or .csv file. Up to 5 MB.</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <Button type="button" onClick={() => inputRef.current?.click()} isLoading={busy}>
              Choose file
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => emailRecipientImportService.downloadTemplate()}>
              <Download className="size-4" /> Download Sample Template
            </Button>
          </div>
        )}

        {step === "mapping" && inspected && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Detected {inspected.totalRows} rows and {inspected.headers.length} columns. Map the columns that hold the recipient&apos;s name and email address.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name column</Label>
                <Select value={nameColumn} onValueChange={setNameColumn}>
                  <SelectTrigger><SelectValue placeholder="Select a column" /></SelectTrigger>
                  <SelectContent>
                    {inspected.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Email column</Label>
                <Select value={emailColumn} onValueChange={setEmailColumn}>
                  <SelectTrigger><SelectValue placeholder="Select a column" /></SelectTrigger>
                  <SelectContent>
                    {inspected.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {otherColumns.length > 0 && (
              <div className="space-y-1.5">
                <Label>Keep as custom variables ({"{{contact.custom.*}}"})</Label>
                <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
                  {otherColumns.map((h) => (
                    <label key={h} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={customColumns.includes(h)}
                        onCheckedChange={(checked) => setCustomColumns((prev) => (checked ? [...prev, h] : prev.filter((c) => c !== h)))}
                      />
                      {h}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>{inspected.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {inspected.sampleRows.map((row, i) => (
                    <TableRow key={i}>{inspected.headers.map((h) => <TableCell key={h}>{row[h]}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ModalFooter className="-mx-5 -mb-4">
              <Button variant="secondary" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handleValidate} disabled={!nameColumn || !emailColumn} isLoading={busy}>Validate</Button>
            </ModalFooter>
          </div>
        )}

        {step === "review" && result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">Total: {result.totalRows}</Badge>
              <Badge variant="success">Valid: {result.validCount}</Badge>
              <Badge variant="danger">Errors: {result.errorCount}</Badge>
              {result.duplicateCount > 0 && <Badge variant="warning">Duplicates: {result.duplicateCount}</Badge>}
            </div>

            {result.errorCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-danger-600">
                    <AlertTriangle className="size-4" /> {result.errorCount} rows will be skipped
                  </p>
                  <Button size="sm" variant="ghost" onClick={downloadErrors}>
                    <Download className="size-4" /> Download error report
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                  <Table>
                    <TableBody>
                      {result.errors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>Row {e.lineNumber}</TableCell>
                          <TableCell>{e.column}</TableCell>
                          <TableCell>{e.message}</TableCell>
                          <TableCell className="text-muted-foreground">{e.rawValue}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {result.validCount > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Preview</p>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.preview.map((r, i) => (
                      <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell>{r.email}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState icon={AlertTriangle} title="No valid rows to use" description="Fix the errors above and try again." />
            )}

            <ModalFooter className="-mx-5 -mb-4">
              <Button variant="secondary" onClick={() => setStep("mapping")}>Back</Button>
              <Button onClick={handleUse} disabled={result.validCount === 0}>
                <CheckCircle2 className="size-4" /> Use {result.validCount} recipients
              </Button>
            </ModalFooter>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
