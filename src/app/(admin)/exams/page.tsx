import { ExamTable } from "@/features/exams/exam-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function ExamsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Examination" }, { label: "All Exams" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Exams</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create and manage examinations across academic years, classes and sections.</p>
      </div>
      <ExamTable />
    </div>
  );
}
