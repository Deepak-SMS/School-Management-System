import { StudentTable } from "@/features/students/student-table";

export default function StudentsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage all students enrolled in your school.</p>
      </div>
      <StudentTable />
    </div>
  );
}
