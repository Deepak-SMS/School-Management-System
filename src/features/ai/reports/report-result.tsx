import { Download, Printer, FileType2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { GeneratedReport } from "@/types/ai-reports";

interface ReportResultProps {
  report: GeneratedReport;
  onExport: (format: "pdf" | "docx") => void;
  onPrint: () => void;
  exporting: "pdf" | "docx" | null;
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-1 space-y-1 text-sm leading-relaxed text-muted-foreground">
        {body.split("\n").filter(Boolean).map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function ReportResult({ report, onExport, onPrint, exporting }: ReportResultProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{report.title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {report.periodLabel} · {report.filtersLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
            <Printer className="size-3.5" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport("docx")} isLoading={exporting === "docx"} className="gap-1.5">
            <FileType2 className="size-3.5" /> DOCX
          </Button>
          <Button size="sm" onClick={() => onExport("pdf")} isLoading={exporting === "pdf"} className="gap-1.5">
            <Download className="size-3.5" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {report.keyStatistics.map((stat) => (
            <div key={stat.label} className="rounded-md border border-border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {report.narrativeError ? (
          <div className="flex items-start gap-2 rounded-md border border-warning-500/30 bg-warning-50 px-3 py-2.5 text-sm text-warning-700 dark:bg-warning-500/10">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{report.narrativeError}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Section title="Executive Summary" body={report.executiveSummary} />
            <Section title="Observations" body={report.observations} />
            <Section title="Areas of Concern" body={report.areasOfConcern} />
            <Section title="Recommendations" body={report.recommendations} />
            <Section title="Conclusion" body={report.conclusion} />
          </div>
        )}

        {report.tableRows.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{report.tableTitle}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  {report.tableColumns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.tableRows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
