import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappContactImportCommitSchema } from "@/lib/validation/whatsapp-contact";

/** Step 3: upserts the already-validated rows by (schoolId, phoneE164) — re-importing the same file updates existing contacts rather than duplicating them. */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("whatsappContacts", "import");
    const { schoolId } = user;
    const input = whatsappContactImportCommitSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const row of input.rows) {
        const existing = await tx.whatsAppContact.findUnique({ where: { schoolId_phoneE164: { schoolId, phoneE164: row.phoneE164 } } });
        await tx.whatsAppContact.upsert({
          where: { schoolId_phoneE164: { schoolId, phoneE164: row.phoneE164 } },
          create: {
            schoolId,
            source: "import",
            name: row.name,
            phoneE164: row.phoneE164,
            rawPhone: row.rawPhone || null,
            tagsJson: row.tags.length ? JSON.stringify(row.tags) : null,
            customFieldsJson: Object.keys(row.customFields).length ? JSON.stringify(row.customFields) : null,
            createdById: user.id,
          },
          update: {
            name: row.name,
            tagsJson: row.tags.length ? JSON.stringify(row.tags) : undefined,
            customFieldsJson: Object.keys(row.customFields).length ? JSON.stringify(row.customFields) : undefined,
            isActive: true,
          },
        });
        if (existing) updated += 1;
        else created += 1;
      }
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappContact.import", entityType: "WhatsAppContact", entityId: schoolId, after: { created, updated } });
      return { created, updated };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
