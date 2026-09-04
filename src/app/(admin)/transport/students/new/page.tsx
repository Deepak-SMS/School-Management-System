"use client";

import { useRouter } from "next/navigation";
import { studentTransportService } from "@/services/transportService";
import { EnrollStudentTransportForm } from "@/features/transport/enroll-student-transport-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewStudentTransportPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Student Transport", href: "/transport/students" }, { label: "Enroll Student" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Enroll Student</h1>
      </div>
      <EnrollStudentTransportForm
        onSubmit={async (input) => {
          await studentTransportService.create(input);
          toast({ title: "Student enrolled in transport", variant: "success" });
          router.push("/transport/students");
        }}
      />
    </div>
  );
}
