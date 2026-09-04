import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { emailTemplatePreviewSchema } from "@/lib/validation/email-template";
import { personalizeMessage, personalizeHtml } from "@/lib/communication/personalize";
import { resolveVariableValues } from "@/lib/email-campaigns/variables";

/** Live preview while composing — either against a real student (parent-facing accuracy, incl. real fee numbers) or sample values typed by the admin. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("emailTemplates", "view");
    const { id } = await params;
    const input = emailTemplatePreviewSchema.parse(await request.json());

    const template = await prisma.emailTemplate.findFirst({ where: { id, schoolId } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    let values = resolveVariableValues({ school });

    if (input.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: input.studentId, schoolId },
        select: { firstName: true, lastName: true, admissionNumber: true, rollNumber: true, dateOfBirth: true, class: { select: { name: true } }, section: { select: { name: true } } },
      });
      if (student) {
        values = resolveVariableValues({
          school,
          student: { ...student, className: student.class.name, sectionName: student.section?.name ?? null },
        });
      }
    }

    values = { ...values, ...input.sampleValues };
    const subject = personalizeMessage(template.subject, values);
    const html = personalizeHtml(template.bodyHtml, values);
    return NextResponse.json({ subject: subject.text, html: html.text, missingVariables: [...new Set([...subject.missingVariables, ...html.missingVariables])] });
  } catch (error) {
    return apiError(error);
  }
}
