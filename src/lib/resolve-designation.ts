import { prisma } from "@/lib/db";

/**
 * Designation is highly variable per school ("Mathematics Teacher", "PGT
 * Physics", "Assistant Vice Principal"...) so the form collects it as free
 * text — much better UX than forcing a picker. This finds-or-creates the
 * Designation entity by name within the school and returns its id.
 */
export async function resolveDesignationId(schoolId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  const code = trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20) || "ROLE";
  const designation = await prisma.designation.upsert({
    where: { schoolId_code: { schoolId, code } },
    update: {},
    create: { schoolId, name: trimmed, code },
  });
  return designation.id;
}
