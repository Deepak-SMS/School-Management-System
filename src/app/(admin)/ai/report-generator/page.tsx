"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { REPORT_TYPES, type ReportType } from "@/lib/ai/reports/types";
import { ClassSectionPicker } from "@/features/ai/shared/class-section-picker";
import { ReportResult } from "@/features/ai/reports/report-result";
import { printReport } from "@/features/ai/reports/report-print";
import { aiReportsService } from "@/services/aiReportsService";
import type { GeneratedReport } from "@/types/ai-reports";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AiReportGeneratorPage() {
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => isoDate(new Date()));

  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);

  const typeInfo = REPORT_TYPES.find((r) => r.value === reportType)!;

  async function handleGenerate() {
    setGenerating(true);
    setReport(null);
    try {
      const result = await aiReportsService.generate({ reportType, classId, sectionId, from, to });
      setReport(result);
    } catch (error) {
      toast({ title: "Report generation failed", description: (error as { error?: string })?.error ?? "Please try again.", variant: "danger" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport(format: "pdf" | "docx") {
    if (!report) return;
    setExporting(format);
    try {
      await aiReportsService.export(report, format);
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "danger" });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Report Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">Generate a professional report from real ERP data, with an AI-written summary.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-col gap-1.5">
            <Label>Report type</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{typeInfo.description}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {typeInfo.needsClassSection && (
              <ClassSectionPicker classId={classId} sectionId={sectionId} onClassChange={setClassId} onSectionChange={setSectionId} />
            )}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={handleGenerate} isLoading={generating} className="gap-1.5">
              <Sparkles className="size-4" /> Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && <ReportResult report={report} onExport={handleExport} onPrint={() => printReport(report)} exporting={exporting} />}
    </div>
  );
}
