"use client";

import { useRouter } from "next/navigation";
import { examService } from "@/services/examService";
import { newsService } from "@/services/newsService";
import { ExamForm } from "@/features/exams/exam-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

/** Plain textarea input → safe paragraph HTML (escaped, one `<p>` per blank-line-separated block). */
function descriptionToHtml(description: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function NewExamPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Examination", href: "/exams" }, { label: "All Exams", href: "/exams" }, { label: "Create Exam" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Create Exam</h1>
      </div>
      <ExamForm
        onSubmit={async (input, announcement) => {
          const exam = await examService.create(input);

          if (!announcement) {
            toast({ title: "Exam created", variant: "success" });
            router.push("/exams");
            return;
          }

          try {
            await newsService.create({
              title: `New Exam: ${exam.name}`,
              contentHtml: descriptionToHtml(announcement.description),
              shortDescription: announcement.description.slice(0, 200),
              categoryId: undefined,
              featuredImageFileId: undefined,
              priority: "normal",
              status: "published",
              audienceType: "students",
              audienceTargets: exam.classes.map((c) => ({ classId: c.classId, sectionId: c.sectionId ?? undefined })),
              attachmentFileIds: [],
              imageFileIds: [],
              commentsEnabled: true,
              notifyInApp: true,
              publishAt: undefined,
              expiresAt: undefined,
              autoArchiveAfterExpiry: true,
              authorStaffId: undefined,
            });
            toast({ title: "Exam created and announced in News", variant: "success" });
          } catch {
            toast({ title: "Exam created", description: "The News announcement couldn't be published — you can post it manually from News Management.", variant: "warning" });
          }

          router.push("/exams");
        }}
      />
    </div>
  );
}
