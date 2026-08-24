import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { apiError } from "@/lib/api-error";
import { renderCardPdf, type DesignElementLike } from "@/lib/pdf/render-card-pdf";
import { resolveStudentFields } from "@/lib/id-cards/resolve-fields";
import { saveFile } from "@/lib/storage";

const requestSchema = z.object({
  templateId: z.string().min(1),
  scope: z.enum(["single", "class", "section", "custom"]),
  studentIds: z.array(z.string()).optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
});

function verificationUrl(request: NextRequest, code: string) {
  return `${request.nextUrl.origin}/verify/${code}`;
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const input = requestSchema.parse(await request.json());

    const template = await prisma.iDCardTemplate.findFirst({
      where: { id: input.templateId, OR: [{ isSystemTemplate: true }, { schoolId }] },
      include: { elements: true },
    });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });

    const studentWhere =
      input.scope === "class" && input.classId
        ? { schoolId, classId: input.classId, status: "active" }
        : input.scope === "section" && input.sectionId
          ? { schoolId, sectionId: input.sectionId, status: "active" }
          : { schoolId, id: { in: input.studentIds ?? [] } };

    const students = await prisma.student.findMany({
      where: studentWhere,
      include: { class: true, section: true, academicYear: true, qrVerification: true },
    });

    if (students.length === 0) {
      return NextResponse.json({ error: "No students matched this selection." }, { status: 400 });
    }

    const job = await prisma.iDCardGenerationJob.create({
      data: {
        schoolId,
        templateId: template.id,
        scope: input.scope,
        classId: input.classId,
        sectionId: input.sectionId,
        status: "processing",
        totalCount: students.length,
        pdfType: students.length > 1 ? "bulk" : "individual",
        sides: template.elements.some((e) => e.side === "back") ? "front_back" : "front_only",
      },
    });

    const elements: DesignElementLike[] = template.elements;
    const individualPdfs: Buffer[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const student of students) {
      try {
        if (!student.qrVerification) throw new Error("Missing verification record");

        const fieldValues = resolveStudentFields(student, school);
        const pdfBuffer = await renderCardPdf({
          cardWidthMm: template.cardWidthMm,
          cardHeightMm: template.cardHeightMm,
          elements,
          fieldValues,
          qrValue: verificationUrl(request, student.qrVerification.code),
          photoBytes: null, // photo upload lands in a later phase
        });
        individualPdfs.push(pdfBuffer);

        const { url: pdfUrl } = await saveFile({
          schoolId,
          kind: "generated_pdf",
          fileName: `${student.admissionNumber}_${student.firstName}_${student.lastName}.pdf`,
          data: pdfBuffer,
          mimeType: "application/pdf",
        });

        const existingCard = await prisma.iDCard.findFirst({ where: { studentId: student.id, templateId: template.id } });
        const idCard = existingCard
          ? await prisma.iDCard.update({
              where: { id: existingCard.id },
              data: { status: "generated", pdfUrl, issuedAt: new Date() },
            })
          : await prisma.iDCard.create({
              data: {
                schoolId,
                templateId: template.id,
                studentId: student.id,
                status: "generated",
                cardNumber: student.admissionNumber,
                pdfUrl,
                issuedAt: new Date(),
              },
            });

        await prisma.iDCardGenerationItem.create({
          data: { jobId: job.id, studentId: student.id, idCardId: idCard.id, status: "success" },
        });
        successCount++;
      } catch (err) {
        await prisma.iDCardGenerationItem.create({
          data: {
            jobId: job.id,
            studentId: student.id,
            status: "failed",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
          },
        });
        failedCount++;
      }
    }

    let outputFileUrl: string | null = null;
    if (individualPdfs.length > 0) {
      const combined = await mergePdfs(individualPdfs);
      const saved = await saveFile({
        schoolId,
        kind: "generated_pdf",
        fileName: `ID_Cards_${job.id}.pdf`,
        data: combined,
        mimeType: "application/pdf",
      });
      outputFileUrl = saved.url;
    }

    const completedJob = await prisma.iDCardGenerationJob.update({
      where: { id: job.id },
      data: { status: "completed", successCount, failedCount, outputFileUrl, completedAt: new Date() },
    });

    return NextResponse.json(completedJob, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}
