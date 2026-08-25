import type { Prisma } from "@/generated/prisma/client";
import type { StudentGuardianInput } from "@/lib/validation/student";

/**
 * Turns the form's guardian blocks into nested StudentGuardian creates.
 *
 * Shared by the create and update routes so "what a guardian means" is defined
 * once — including the defaults that decide who gets contacted: the first
 * guardian listed is the primary contact and emergency contact unless the form
 * says otherwise.
 */
export function buildStudentGuardianCreates(
  schoolId: string,
  guardians: StudentGuardianInput[] | undefined,
): Prisma.StudentGuardianCreateWithoutStudentInput[] {
  // Blocks left blank aren't errors — a single-parent family shouldn't have to
  // delete the other card to submit.
  const filled = (guardians ?? []).filter((g) => g.fullName?.trim());

  return filled.map((g, index) => {
    const fullName = g.fullName.trim();
    const [firstName, ...rest] = fullName.split(" ");

    return {
      relationship: g.relationship,
      isPrimary: g.isPrimary ?? index === 0,
      isEmergencyContact: g.isEmergencyContact ?? index === 0,
      isAuthorizedPickup: g.isAuthorizedPickup ?? true,
      canReceiveAcademic: g.canReceiveAcademic ?? true,
      canReceiveFee: g.canReceiveFee ?? index === 0,
      sortOrder: index,
      guardian: {
        create: {
          schoolId,
          firstName,
          lastName: rest.join(" ") || null,
          fullName,
          mobile: g.mobile ?? null,
          alternateMobile: g.alternateMobile ?? null,
          email: g.email ?? null,
          occupation: g.occupation ?? null,
          // The form calls these Employer and Qualification; Guardian stores them
          // under its own general-purpose names.
          organization: g.organization ?? null,
          education: g.education ?? null,
          address: g.address ?? null,
        },
      },
    };
  });
}
