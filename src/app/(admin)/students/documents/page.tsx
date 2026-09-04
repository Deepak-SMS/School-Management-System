import { StudentDocumentsBrowser } from "@/features/students/student-documents-browser";

export default function StudentDocumentsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Student Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a class and section to see its students and every document filed for them.
        </p>
      </div>
      <StudentDocumentsBrowser />
    </div>
  );
}
