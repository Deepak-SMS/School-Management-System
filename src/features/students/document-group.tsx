import { FileText } from "lucide-react";
import type { StudentDocumentRecord } from "@/types/student";
import { STUDENT_DOCUMENT_LABELS } from "@/lib/constants/student-documents";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** One category's worth of a student's filed documents — shared by the student profile and the class/section document browser. */
export function DocumentGroup({ title, documents }: { title: string; documents: StudentDocumentRecord[] }) {
  if (documents.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {doc.title || STUDENT_DOCUMENT_LABELS[doc.documentType] || doc.documentType}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {doc.uploadedFile?.originalName ?? "File"}
                {doc.version > 1 ? ` · v${doc.version}` : ""}
                {doc.issuedOn ? ` · issued ${doc.issuedOn.slice(0, 10)}` : ""}
              </p>
            </div>
            <Badge variant={doc.status === "verified" ? "success" : doc.status === "rejected" ? "danger" : "neutral"}>
              {doc.status}
            </Badge>
            {/* Files are never public — this route checks permission before streaming. */}
            <a
              href={`/api/files/${doc.uploadedFileId}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary-600 underline-offset-4 hover:underline"
            >
              View
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
