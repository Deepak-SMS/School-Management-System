import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolveStudentFields, resolveStaffFields } from "@/lib/id-cards/resolve-fields";
import { readBytesFromStoredUrl, verificationUrl } from "@/lib/id-cards/card-assets";
import { renderCardPdf, type DesignElementLike } from "@/lib/pdf/render-card-pdf";
import { mergePdfs } from "@/lib/pdf/merge-pdfs";
import { apiError } from "@/lib/api-error";

/** Kept modest: rendering is CPU-bound and a runaway request would block the server. */
const MAX_CARDS = 200;

const bodySchema = z.object({
  people: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        personType: z.enum(["student", "teacher", "staff"]),
      }),
    )
    .min(1, "Select at least one person")
    .max(MAX_CARDS),
});

/**
 * Renders ID cards for the selected people into one PDF, in the order given.
 *
 * Uses each person's fixed design, the same as the single-card download, so a
 * batch printed from here matches what the preview showed. Anyone whose card
 * can't be rendered is skipped and reported in a header rather than failing the
 * whole batch — one missing photo shouldn't cost you the other 199 cards.
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("idCards", "view");
    const input = bodySchema.parse(await request.json());

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const logoBytes = await readBytesFromStoredUrl(school.logoUrl);

    // Templates and their elements are fetched once and reused across the batch
    // rather than per person.
    const templateCache = new Map<string, { template: { id: string; cardWidthMm: number; cardHeightMm: number }; elements: DesignElementLike[] }>();

    async function templateFor(category: "student" | "staff", ownTemplateId?: string | null) {
      const key = ownTemplateId ?? `category:${category}`;
      const cached = templateCache.get(key);
      if (cached) return cached;

      const template = ownTemplateId
        ? await prisma.iDCardTemplate.findUnique({ where: { id: ownTemplateId } })
        : ((await prisma.iDCardTemplate.findFirst({
            where: {
              isActive: true,
              category: category === "student" ? "student" : { in: ["staff", "teacher"] },
              OR: [{ schoolId }, { isSystemTemplate: true }],
            },
            orderBy: [{ schoolId: "desc" }, { isDefault: "desc" }],
          })) ??
          (await prisma.iDCardTemplate.findFirst({
            where: { isActive: true, OR: [{ schoolId }, { isSystemTemplate: true }] },
          })));

      if (!template) return null;

      const elements = (await prisma.designElement.findMany({
        where: { templateId: template.id },
        orderBy: { zIndex: "asc" },
      })) as DesignElementLike[];

      const entry = { template, elements };
      templateCache.set(key, entry);
      return entry;
    }

    const pdfs: Buffer[] = [];
    const skipped: string[] = [];

    for (const person of input.people) {
      try {
        const isStudent = person.personType === "student";

        const student = isStudent
          ? await prisma.student.findFirst({
              where: { id: person.id, schoolId },
              include: {
                class: true,
                section: true,
                academicYear: true,
                guardians: { include: { guardian: true } },
                qrVerification: { select: { code: true } },
                idCards: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            })
          : null;

        const staff = !isStudent
          ? await prisma.staff.findFirst({
              where: { id: person.id, schoolId },
              include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
                qrVerification: { select: { code: true } },
                idCards: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            })
          : null;

        if (!student && !staff) {
          skipped.push(person.id);
          continue;
        }

        const existingCard = (student ?? staff)!.idCards[0] ?? null;
        const entry = await templateFor(isStudent ? "student" : "staff", existingCard?.templateId);
        if (!entry) {
          skipped.push(person.id);
          continue;
        }

        const fields = student ? resolveStudentFields(student, school) : resolveStaffFields(staff!, school);
        const reference = student ? student.admissionNumber : staff!.employeeId;
        const photoBytes = await readBytesFromStoredUrl(student ? student.photoUrl : staff!.photoUrl);
        const code = (student ?? staff)!.qrVerification?.code;

        pdfs.push(
          await renderCardPdf({
            cardWidthMm: entry.template.cardWidthMm,
            cardHeightMm: entry.template.cardHeightMm,
            elements: entry.elements,
            fieldValues: fields,
            qrValue: code ? verificationUrl(request.nextUrl.origin, code) : undefined,
            barcodeValue: existingCard?.barcodeValue ?? existingCard?.cardNumber ?? reference,
            photoBytes,
            logoBytes,
          }),
        );
      } catch {
        // One bad record shouldn't lose the rest of the batch.
        skipped.push(person.id);
      }
    }

    if (pdfs.length === 0) {
      return NextResponse.json(
        { error: "None of the selected cards could be rendered. Check that a design exists for them." },
        { status: 409 },
      );
    }

    const merged = await mergePdfs(pdfs);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(merged), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="id-cards-${pdfs.length}-${stamp}.pdf"`,
        // The client surfaces this so a partial batch is never silently partial.
        "X-Cards-Rendered": String(pdfs.length),
        "X-Cards-Skipped": String(skipped.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
