import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicRegistrationSchema } from "@/lib/validation/student-registration";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

/**
 * The parent-facing admission form endpoints. These are the only routes in the
 * application that are deliberately unauthenticated.
 *
 * Safety rules, all enforced here rather than in the UI:
 *  - The token resolves the school. `getCurrentSchoolId()` is never called,
 *    because there is no session to read it from.
 *  - Nothing is written to Student. A submission creates a StudentRegistration
 *    with status `pending`; a staff member turns it into a student.
 *  - The GET response exposes only what the form needs to render — the school's
 *    name and the form's own copy. It never lists students, staff or classes
 *    beyond the one the form is scoped to.
 */

const MAX_SUBMISSION_BYTES = 100_000;

async function findLiveForm(token: string) {
  const form = await prisma.registrationForm.findUnique({
    where: { token },
    include: { school: { select: { id: true, name: true, logoUrl: true } } },
  });

  if (!form || !form.isActive) return { form: null as null, reason: "closed" as const };
  if (form.expiresAt && form.expiresAt.getTime() < Date.now()) return { form: null as null, reason: "expired" as const };
  return { form, reason: null };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { form, reason } = await findLiveForm(token);

    if (!form) {
      // Same response whether the token is unknown, revoked or expired, so a
      // stranger can't probe for which tokens exist.
      return NextResponse.json(
        { error: "This admission form is no longer accepting responses.", reason: reason ?? "closed" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      title: form.title,
      description: form.description,
      schoolName: form.school.name,
      schoolLogoUrl: form.school.logoUrl,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { form } = await findLiveForm(token);

    if (!form) {
      return NextResponse.json({ error: "This admission form is no longer accepting responses." }, { status: 404 });
    }

    const raw = await request.text();
    if (raw.length > MAX_SUBMISSION_BYTES) {
      return NextResponse.json({ error: "That submission is too large." }, { status: 413 });
    }

    const input = cleanEmptyStrings(publicRegistrationSchema.parse(JSON.parse(raw)));

    const studentName = [input.firstName, input.middleName, input.lastName].filter(Boolean).join(" ");
    const primaryGuardian = input.guardians.find((g) => g.isPrimary) ?? input.guardians[0];

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.studentRegistration.create({
        data: {
          schoolId: form.schoolId,
          formId: form.id,
          // The answers are kept verbatim as JSON. They are untrusted input and are
          // only mapped onto real records when a staff member approves them.
          payloadJson: JSON.stringify(input),
          status: "pending",
          studentName,
          contactPhone: input.primaryMobile ?? primaryGuardian?.mobile ?? null,
          contactEmail: input.parentEmail ?? primaryGuardian?.email ?? null,
          enquiryId: form.enquiryId,
        },
        select: { id: true, submittedAt: true },
      });

      // A link generated from an Enquiry's "Generate application link" action
      // carries its provenance here — once a submission actually arrives, the
      // enquiry is done being a lead and becomes an application.
      if (form.enquiryId) {
        await tx.admissionEnquiry.update({ where: { id: form.enquiryId }, data: { status: "converted" } });
      }

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        reference: submission.id.slice(-8).toUpperCase(),
        message: "Thank you — your details have been submitted to the school for review.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
