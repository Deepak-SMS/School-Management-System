import { ExamTypeManager } from "@/features/exam-types/exam-type-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function ExamTypesPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Examination", href: "/exams" }, { label: "Exam Types" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Exam Types</h1>
        <p className="mt-1 text-sm text-muted-foreground">Unit Test, Quarterly, Half-Yearly, Annual — the kinds of examination Exam Creation is scheduled against.</p>
      </div>
      <ExamTypeManager />
    </div>
  );
}
