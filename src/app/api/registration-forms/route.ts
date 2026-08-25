import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

const formInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().max(1000).optional(),
  academicYearId: z.string().trim().optional(),
  classId: z.string().trim().optional(),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid expiry date"),
});

export async function GET() {
  try {
    const { schoolId } = await requirePermission("studentRegistrations", "view");

    const data = await prisma.registrationForm.findMany({
      where: { schoolId },
      include: { _count: { select: { submissions: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Pending count per form drives the "needs review" badge in the UI.
    const withPending = await Promise.all(
      data.map(async (form) => ({
        ...form,
        counts: {
          total: form._count.submissions,
          pending: await prisma.studentRegistration.count({ where: { formId: form.id, status: "pending" } }),
        },
      })),
    );

    return NextResponse.json({ data: withPending });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("studentRegistrations", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(formInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const form = await tx.registrationForm.create({
        data: {
          schoolId,
          // 32 hex chars of CSPRNG — long enough that the public URL can't be
          // guessed or enumerated, and revocable by deactivating the form.
          token: randomBytes(16).toString("hex"),
          title: input.title,
          description: input.description,
          academicYearId: input.academicYearId,
          classId: input.classId,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          createdById: user.id,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "registrationForm.create",
        entityType: "RegistrationForm",
        entityId: form.id,
        after: { title: form.title },
      });

      return form;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
