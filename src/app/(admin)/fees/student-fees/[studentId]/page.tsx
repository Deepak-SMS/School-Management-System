"use client";

import { use } from "react";
import { StudentFeeDetail } from "@/features/student-fees/student-fee-detail";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function StudentFeeDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <Breadcrumb
        items={[
          { label: "Fees & Finance", href: "/fees/structure" },
          { label: "Student Fees", href: "/fees/student-fees" },
          { label: "Account" },
        ]}
      />
      <StudentFeeDetail studentId={studentId} />
    </div>
  );
}
