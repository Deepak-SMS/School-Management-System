"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Database, Download, FileSpreadsheet, Upload } from "lucide-react";
import { databaseService, type DatasetSummary, type ImportPlan, type ImportResult } from "@/services/databaseService";
import type { ApiError } from "@/services/studentService";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

type Stage = { kind: "idle" } | { kind: "planned"; file: File; plan: ImportPlan } | { kind: "done"; result: ImportResult };

export function DatabaseManager() {
  const can = useCan();
  const canExport = can("database", "export");
  const canImport = can("database", "import");

  const [datasets, setDatasets] = useState<DatasetSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState<null | "export" | "template" | "validate" | "commit">(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    databaseService
      .listDatasets()
      .then((r) => {
        setDatasets(r.data);
        setSelected(new Set(r.data.map((d) => d.key)));
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  if (loadError) return <ErrorState onRetry={load} />;
  if (!datasets) return <LoadingState className="py-16" />;

  const allSelected = selected.size === datasets.length;
  const chosen = allSelected ? undefined : [...selected];
  const totalRows = datasets.filter((d) => selected.has(d.key)).reduce((n, d) => n + d.rowCount, 0);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(datasets!.map((d) => d.key)));
  }

  async function run(kind: "export" | "template", action: () => Promise<void>) {
    setError(null);
    setBusy(kind);
    try {
      await action();
    } catch (e) {
      setError((e as ApiError)?.error ?? "The download failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setStage({ kind: "idle" });
    setBusy("validate");
    try {
      const plan = await databaseService.validateImport(file);
      setStage({ kind: "planned", file, plan });
    } catch (e) {
      setError((e as ApiError)?.error ?? "That file couldn't be read.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function commit() {
    if (stage.kind !== "planned") return;
    setError(null);
    setBusy("commit");
    try {
      const result = await databaseService.commitImport(stage.file);
      setStage({ kind: "done", result });
      toast({
        title: "Import complete",
        description: `${result.created} created, ${result.updated} updated.`,
        variant: "success",
      });
      load();
    } catch (e) {
      setError((e as ApiError)?.error ?? "The import failed. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="danger" title="Couldn't complete that">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What the workbook contains</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            One sheet per area of the school, read live at the moment you download — anything edited or added anywhere in
            the app is already in the file. Pick the sheets you want, or leave them all ticked for the whole database.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label={allSelected ? "Clear all sheets" : "Select all sheets"}
                  />
                </TableHead>
                <TableHead>Sheet</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Columns</TableHead>
                <TableHead>Import</TableHead>
                <TableHead>Holds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.map((d) => (
                <TableRow key={d.key}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(d.key)}
                      onCheckedChange={() => toggle(d.key)}
                      aria-label={`Include ${d.label}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  <TableCell>{d.rowCount}</TableCell>
                  <TableCell>{d.columnCount}</TableCell>
                  <TableCell>
                    <Badge variant={d.importable ? "success" : "neutral"}>{d.importable ? "yes" : "read only"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <p className="text-sm text-muted-foreground">
            {selected.size} of {datasets.length} sheets · {totalRows} rows
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export database</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3 text-sm">
            <p className="text-muted-foreground">
              Downloads the selected sheets as one .xlsx workbook, filled with the school&apos;s current data. Edit it and
              upload the same file to apply changes.
            </p>
            <Button
              onClick={() => run("export", () => databaseService.exportWorkbook(chosen))}
              isLoading={busy === "export"}
              disabled={!canExport || selected.size === 0}
            >
              <Download className="size-4" /> Export database
            </Button>
            {!canExport && <p className="text-xs text-muted-foreground">Your role can&apos;t export the database.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Download format</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3 text-sm">
            <p className="text-muted-foreground">
              The same workbook with one example row per sheet instead of your data, plus a Read Me listing every column
              and the values it accepts.
            </p>
            <Button
              variant="secondary"
              onClick={() => run("template", () => databaseService.downloadTemplate(chosen))}
              isLoading={busy === "template"}
              disabled={selected.size === 0}
            >
              <FileSpreadsheet className="size-4" /> Download format
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import database</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            Upload a filled-in workbook. It is checked first and nothing is written until you confirm — and a file with any
            invalid row is refused whole, never imported halfway.
          </p>

          <div>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              isLoading={busy === "validate"}
              disabled={!canImport}
            >
              <Upload className="size-4" /> Choose workbook
            </Button>
            {!canImport && <p className="mt-2 text-xs text-muted-foreground">Your role can&apos;t import the database.</p>}
          </div>

          {stage.kind === "planned" && <ImportPreview plan={stage.plan} onCommit={commit} committing={busy === "commit"} />}

          {stage.kind === "done" && (
            <Alert variant="success" title="Import complete">
              <p>
                {stage.result.created} record{stage.result.created === 1 ? "" : "s"} created and {stage.result.updated}{" "}
                updated.
              </p>
              <ul className="mt-2 list-disc pl-5">
                {stage.result.bySheet
                  .filter((s) => s.created > 0 || s.updated > 0)
                  .map((s) => (
                    <li key={s.label}>
                      {s.label}: {s.created} created, {s.updated} updated
                    </li>
                  ))}
              </ul>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImportPreview({ plan, onCommit, committing }: { plan: ImportPlan; onCommit: () => void; committing: boolean }) {
  const blocked = plan.issues.length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">What this file would do</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sheet</TableHead>
            <TableHead>Create</TableHead>
            <TableHead>Update</TableHead>
            <TableHead>Rows with problems</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.sheets.map((s) => (
            <TableRow key={s.sheet}>
              <TableCell className="font-medium">{s.label}</TableCell>
              <TableCell>{s.create}</TableCell>
              <TableCell>{s.update}</TableCell>
              <TableCell>{s.skipped > 0 ? <Badge variant="danger">{s.skipped}</Badge> : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {plan.unknownSheets.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ignored sheets not in the template: {plan.unknownSheets.join(", ")}
        </p>
      )}

      {blocked ? (
        <Alert variant="danger" title={`${plan.issues.length} problem${plan.issues.length === 1 ? "" : "s"} to fix first`}>
          <p className="mb-2">Nothing has been written. Fix these in the workbook and upload it again.</p>
          <ul className="flex max-h-64 list-disc flex-col gap-1 overflow-y-auto pl-5">
            {plan.issues.slice(0, 50).map((issue, i) => (
              <li key={i}>
                <span className="font-medium">
                  {issue.sheet} row {issue.row}
                  {issue.column ? ` · ${issue.column}` : ""}
                </span>
                : {issue.message}
              </li>
            ))}
          </ul>
          {plan.issues.length > 50 && <p className="mt-2">…and {plan.issues.length - 50} more.</p>}
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onCommit} isLoading={committing}>
            <Check className="size-4" /> Import {plan.totalCreate + plan.totalUpdate} record
            {plan.totalCreate + plan.totalUpdate === 1 ? "" : "s"}
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Rows removed from the workbook are left alone — this never deletes.
          </p>
        </div>
      )}
    </div>
  );
}
