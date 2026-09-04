import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { emailCampaignTestSchema } from "@/lib/validation/email-test";
import { personalizeMessage, personalizeHtml } from "@/lib/communication/personalize";
import { resolveVariableValues, EMAIL_SAMPLE_VALUES } from "@/lib/email-campaigns/variables";
import { getEmailProvider } from "@/lib/email-campaigns/registry";
import { isGmailConnected } from "@/lib/email-campaigns/account";

/**
 * Sends exactly one email, never the campaign's real recipient list (spec
 * §24) — to an address the admin explicitly types, validated server-side
 * regardless of whatever the client pre-filled it with.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("emailCampaigns", "create");
    const { id } = await params;
    const input = emailCampaignTestSchema.parse(await request.json());

    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    if (!(await isGmailConnected(schoolId))) {
      return NextResponse.json({ error: "Connect Gmail before sending a test email." }, { status: 409 });
    }

    let values = EMAIL_SAMPLE_VALUES;
    if (input.studentId) {
      const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
      const student = await prisma.student.findFirst({
        where: { id: input.studentId, schoolId },
        select: { firstName: true, lastName: true, admissionNumber: true, rollNumber: true, dateOfBirth: true, class: { select: { name: true } }, section: { select: { name: true } } },
      });
      if (student) {
        values = { ...EMAIL_SAMPLE_VALUES, ...resolveVariableValues({ school, student: { ...student, className: student.class.name, sectionName: student.section?.name ?? null } }) };
      }
    }

    const subject = `[TEST] ${personalizeMessage(campaign.subject, values).text}`;
    const html = personalizeHtml(campaign.bodyHtml, values).text;
    const text = personalizeMessage(campaign.bodyText, values).text;

    const result = await getEmailProvider().sendEmail(schoolId, { to: input.to, subject, html, text });
    if (!result.success) return NextResponse.json({ error: result.error ?? "Test email failed to send." }, { status: 502 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
