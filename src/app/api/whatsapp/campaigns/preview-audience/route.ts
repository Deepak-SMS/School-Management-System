import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { whatsappCampaignCreateSchema } from "@/lib/validation/whatsapp-campaign";
import { resolveWhatsAppAudience, getClassTeacherName } from "@/lib/whatsapp/audience";
import { assertAudienceAllowedForUser } from "@/lib/whatsapp/campaign-scope";
import { normalizePhone } from "@/lib/whatsapp/phone";

const SAMPLE_SIZE = 25;

const previewSchema = whatsappCampaignCreateSchema.pick({
  audienceMode: true,
  classId: true,
  sectionId: true,
  thresholdPct: true,
  tag: true,
  contactIds: true,
});

/**
 * Read-only audience preview for the campaign wizard's Audience step — shows
 * the actual students/guardians (and the class teacher, when a class is
 * selected) as soon as the admin picks an audience, before a draft campaign
 * even exists. Same resolution path /validate and /send use, just capped and
 * shaped for display rather than counted.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("whatsappCampaigns", "create");
    const { schoolId } = user;
    const input = previewSchema.parse(await request.json());

    await assertAudienceAllowedForUser(user, input.audienceMode, input.classId, input.sectionId);

    const [audience, classTeacher] = await Promise.all([
      resolveWhatsAppAudience(input.audienceMode, {
        schoolId,
        classId: input.classId,
        sectionId: input.sectionId,
        thresholdPct: input.thresholdPct,
        tag: input.tag,
        contactIds: input.contactIds,
      }),
      input.audienceMode === "class_parents" ? getClassTeacherName(input.classId, input.sectionId) : Promise.resolve(null),
    ]);

    const sample = audience.recipients.slice(0, SAMPLE_SIZE).map((r) => ({
      studentName: r.variableValues["student.name"] || null,
      guardianName: r.name,
      phone: normalizePhone(r.phoneRaw).e164,
      className: r.variableValues["student.class"] || null,
      sectionName: r.variableValues["student.section"] || null,
    }));

    return NextResponse.json({
      label: audience.label,
      total: audience.recipients.length,
      classTeacher,
      sample,
      truncated: audience.recipients.length > SAMPLE_SIZE,
    });
  } catch (error) {
    return apiError(error);
  }
}
