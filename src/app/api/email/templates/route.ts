import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { emailTemplateSchema } from "@/lib/validation/email-template";
import { extractVariables } from "@/lib/communication/personalize";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email-campaigns/sanitize";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("emailTemplates", "view");
    const params = request.nextUrl.searchParams;
    const category = params.get("category") ?? undefined;
    const q = params.get("q")?.trim();

    const where: Prisma.EmailTemplateWhereInput = {
      schoolId,
      isActive: true,
      ...(category && { category }),
      ...(q && { name: { contains: q } }),
    };

    const data = await prisma.emailTemplate.findMany({ where, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("emailTemplates", "create");
    const { schoolId } = user;
    const input = emailTemplateSchema.parse(await request.json());
    const bodyHtml = sanitizeEmailHtml(input.bodyHtml);
    const bodyText = htmlToPlainText(bodyHtml);

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.emailTemplate.create({
        data: {
          schoolId,
          name: input.name,
          description: input.description,
          category: input.category,
          subject: input.subject,
          bodyHtml,
          bodyText,
          variablesJson: JSON.stringify([...new Set([...extractVariables(input.subject), ...extractVariables(bodyHtml)])]),
          isActive: input.isActive,
          createdById: user.id,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailTemplate.create", entityType: "EmailTemplate", entityId: created.id, after: { name: input.name } });
      return created;
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
