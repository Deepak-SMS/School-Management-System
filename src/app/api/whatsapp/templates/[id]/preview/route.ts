import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { whatsappTemplatePreviewSchema } from "@/lib/validation/whatsapp-template";
import { personalizeMessage } from "@/lib/communication/personalize";
import { resolveVariableValues } from "@/lib/whatsapp/variables";

/** Live preview while composing — either against a real student (parent-facing accuracy) or sample values typed by the admin. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("whatsappTemplates", "view");
    const { id } = await params;
    const input = whatsappTemplatePreviewSchema.parse(await request.json());

    const template = await prisma.whatsAppTemplate.findFirst({ where: { id, schoolId } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    let values = resolveVariableValues({ school });

    if (input.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: input.studentId, schoolId },
        select: { firstName: true, lastName: true, admissionNumber: true, rollNumber: true, class: { select: { name: true } }, section: { select: { name: true } } },
      });
      if (student) {
        values = resolveVariableValues({
          school,
          student: { firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber, rollNumber: student.rollNumber, className: student.class.name, sectionName: student.section?.name ?? null },
        });
      }
    }

    values = { ...values, ...input.sampleValues };
    const result = personalizeMessage(template.bodyText, values);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
