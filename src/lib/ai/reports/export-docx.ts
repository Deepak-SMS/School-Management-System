import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import type { GeneratedReport } from "@/lib/ai/reports/types";

function textSection(title: string, body: string): Paragraph[] {
  const paragraphs = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } })];
  const lines = (body || "—").split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines.length ? lines : ["—"]) {
    paragraphs.push(new Paragraph({ text: line, spacing: { after: 60 } }));
  }
  return paragraphs;
}

export async function renderReportDocx(report: GeneratedReport): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `${report.periodLabel}  ·  ${report.filtersLabel}`, spacing: { after: 60 } }),
    new Paragraph({
      children: [new TextRun({ text: `Generated ${new Date(report.generatedAt).toLocaleString("en-IN")}`, italics: true, size: 18 })],
      spacing: { after: 240 },
    }),
    new Paragraph({ text: "Key Statistics", heading: HeadingLevel.HEADING_2, spacing: { after: 80 } }),
    ...report.keyStatistics.map(
      (stat) => new Paragraph({ children: [new TextRun({ text: `${stat.label}: `, bold: true }), new TextRun(stat.value)], spacing: { after: 40 } }),
    ),
  ];

  if (report.narrativeError) {
    children.push(new Paragraph({ text: "AI Narrative", heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }));
    children.push(new Paragraph({ text: report.narrativeError }));
  } else {
    children.push(...textSection("Executive Summary", report.executiveSummary));
    children.push(...textSection("Observations", report.observations));
    children.push(...textSection("Areas of Concern", report.areasOfConcern));
    children.push(...textSection("Recommendations", report.recommendations));
    children.push(...textSection("Conclusion", report.conclusion));
  }

  if (report.tableRows.length > 0) {
    children.push(new Paragraph({ text: report.tableTitle, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: report.tableColumns.map(
              (col) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: col, bold: true })] })] }),
            ),
          }),
          ...report.tableRows.map(
            (row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph(String(cell))] })) }),
          ),
        ],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
