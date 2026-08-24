"use client";

import { useRouter } from "next/navigation";
import { StudentForm } from "@/features/students/student-form";
import { studentService } from "@/services/studentService";
import { toast } from "@/hooks/use-toast";
import type { StudentInput } from "@/lib/validation/student";

export default function NewStudentPage() {
  const router = useRouter();

  async function handleSubmit(input: StudentInput) {
    const student = await studentService.create(input);
    toast({ title: "Student added", description: `${student.firstName} ${student.lastName} (${student.admissionNumber})`, variant: "success" });
    router.push("/students");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Add student</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A verification QR identifier is generated automatically once the student is saved.
        </p>
      </div>
      <StudentForm onSubmit={handleSubmit} />
    </div>
  );
}
