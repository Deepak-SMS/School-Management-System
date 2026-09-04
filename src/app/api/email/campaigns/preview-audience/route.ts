import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { emailCampaignCreateSchema } from "@/lib/validation/email-campaign";
import { resolveEmailAudience } from "@/lib/email-campaigns/audience";
import { assertRecipientTypeAllowedForUser } from "@/lib/email-campaigns/campaign-scope";

const SAMPLE_SIZE = 25;

const previewSchema = emailCampaignCreateSchema.pick({
  recipientType: true,
  studentIds: true,
  classIds: true,
  sectionIds: true,
  minPendingAmount: true,
});

/** Read-only recipient preview for the campaign wizard's Recipients step — real students/parents/fee numbers, before a draft campaign even exists. */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("emailCampaigns", "create");
    const { schoolId } = user;
    const input = previewSchema.parse(await request.json());

    assertRecipientTypeAllowedForUser(user, input.recipientType);

    const audience = await resolveEmailAudience(input.recipientType, {
      schoolId,
      studentIds: input.studentIds,
      classIds: input.classIds,
      sectionIds: input.sectionIds,
      minPendingAmount: input.minPendingAmount,
    });

    const sample = audience.recipients.slice(0, SAMPLE_SIZE).map((r) => ({
      studentName: r.variableValues["student.name"] || null,
      guardianName: r.name,
      email: r.emailRaw,
      className: r.variableValues["student.class_name"] || null,
      sectionName: r.variableValues["student.section_name"] || null,
      pendingFees: r.variableValues["fee.pending_fees"] || null,
    }));

    return NextResponse.json({
      label: audience.label,
      total: audience.recipients.length,
      missingEmailCount: audience.recipients.filter((r) => !r.emailRaw).length,
      sample,
      truncated: audience.recipients.length > SAMPLE_SIZE,
    });
  } catch (error) {
    return apiError(error);
  }
}
