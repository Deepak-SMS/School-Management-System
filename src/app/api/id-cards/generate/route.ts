import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { renderCardPdf, type DesignElementLike } from "@/lib/pdf/render-card-pdf";
import { resolveStudentFields, resolveStaffFields } from "@/lib/id-cards/resolve-fields";
import { saveFile, readStoredFile } from "@/lib/storage";

const requestSchema = z.object({
  templateId: z.string().min(1),
  cardType: z.enum(["student", "staff"]).default("student"),
  scope: z.enum(["single", "class", "section", "category", "custom"]),
  studentIds: z.array(z.string()).optional(),
  staffIds: z.array(z.string()).optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  staffCategory: z.string().optional(),
});

function verificationUrl(request: NextRequest, code: string) {
  return `${request.nextUrl.origin}/verify/${code}`;
}

/** Local file URLs look like `/api/files/{uploadedFileId}` — resolve straight to bytes, or null for anything else (external URL, unset). */
async function readBytesFromStoredUrl(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  const match = url.match(/\/api\/files\/([^/?]+)/);
  if (!match) return null;
  const stored = await readStoredFile(match[1]);
  return stored?.data ?? null;
}

interface CardSubject {
  studentId?: string;
  staffId?: string;
  cardNumber: string;
  fileNamePart: string;
  qrCode: string | undefined;
  fieldValues: Record<string, string>;
  photoUrl: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("idCards", "create");
    const input = requestSchema.parse(await request.json());

    const template = await prisma.iDCardTemplate.findFirst({
      where: { id: input.templateId, OR: [{ isSystemTemplate: true }, { schoolId }] },
      include: { elements: true },
    });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const logoBytes = await readBytesFromStoredUrl(school.logoUrl);

    let subjects: CardSubject[];

    if (input.cardType === "staff") {
      const staffWhere =
        input.scope === "category" && input.staffCategory
          ? { schoolId, category: input.staffCategory, employmentStatus: "active" }
          : { schoolId, id: { in: input.staffIds ?? [] } };

      const staffList = await prisma.staff.findMany({
        where: staffWhere,
        include: { department: { select: { name: true } }, designation: { select: { name: true } }, qrVerification: true },
      });
      if (staffList.length === 0) {
        return NextResponse.json({ error: "No staff matched this selection." }, { status: 400 });
      }

      subjects = staffList.map((staff) => ({
        staffId: staff.id,
        cardNumber: staff.employeeId,
        fileNamePart: `${staff.employeeId}_${staff.fullName.replace(/\s+/g, "_")}`,
        qrCode: staff.qrVerification?.code,
        fieldValues: resolveStaffFields(staff, school),
        photoUrl: staff.photoUrl,
      }));
    } else {
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

      subjects = students.map((student) => ({
        studentId: student.id,
        cardNumber: student.admissionNumber,
        fileNamePart: `${student.admissionNumber}_${student.firstName}_${student.lastName}`,
        qrCode: student.qrVerification?.code,
        fieldValues: resolveStudentFields(student, school),
        photoUrl: student.photoUrl,
      }));
    }

    const job = await prisma.iDCardGenerationJob.create({
      data: {
        schoolId,
        templateId: template.id,
        scope: input.scope,
        classId: input.classId,
        sectionId: input.sectionId,
        status: "processing",
        totalCount: subjects.length,
        pdfType: subjects.length > 1 ? "bulk" : "individual",
        sides: template.elements.some((e) => e.side === "back") ? "front_back" : "front_only",
      },
    });

    const elements: DesignElementLike[] = template.elements;
    const individualPdfs: Buffer[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const subject of subjects) {
      try {
        if (!subject.qrCode) throw new Error("Missing verification record");

        const photoBytes = await readBytesFromStoredUrl(subject.photoUrl);
        const pdfBuffer = await renderCardPdf({
          cardWidthMm: template.cardWidthMm,
          cardHeightMm: template.cardHeightMm,
          elements,
          fieldValues: subject.fieldValues,
          qrValue: verificationUrl(request, subject.qrCode),
          barcodeValue: subject.cardNumber,
          photoBytes,
          logoBytes,
        });
        individualPdfs.push(pdfBuffer);

        const { url: pdfUrl } = await saveFile({
          schoolId,
          kind: "generated_pdf",
          fileName: `${subject.fileNamePart}.pdf`,
          data: pdfBuffer,
          mimeType: "application/pdf",
        });

        const existingCard = await prisma.iDCard.findFirst({
          where: subject.studentId
            ? { studentId: subject.studentId, templateId: template.id }
            : { staffId: subject.staffId, templateId: template.id },
        });
        const idCard = existingCard
          ? await prisma.iDCard.update({
              where: { id: existingCard.id },
              data: { status: "generated", pdfUrl, issuedAt: new Date() },
            })
          : await prisma.iDCard.create({
              data: {
                schoolId,
                templateId: template.id,
                studentId: subject.studentId,
                staffId: subject.staffId,
                status: "generated",
                cardNumber: subject.cardNumber,
                pdfUrl,
                issuedAt: new Date(),
              },
            });

        await prisma.iDCardGenerationItem.create({
          data: { jobId: job.id, studentId: subject.studentId, staffId: subject.staffId, idCardId: idCard.id, status: "success" },
        });
        successCount++;
      } catch (err) {
        await prisma.iDCardGenerationItem.create({
          data: {
            jobId: job.id,
            studentId: subject.studentId,
            staffId: subject.staffId,
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
